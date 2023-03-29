import { LevelDb } from './leveldb_db.js';

const dbName = 'db';
const db = new LevelDb('/opfs/' + dbName);

let selectedHandle;

const openButton = document.getElementById("open_button");
openButton.addEventListener("click", async () => {
  selectedHandle = await window.showDirectoryPicker();

  // TODO: Clear any existing database first.
  // Otherwise, this may fail due to a locking error.
  await copyDirectory(selectedHandle, await getOpfsDbHandle());
});

const saveButton = document.getElementById("save_button");
saveButton.addEventListener("click", async () => {
  if (!selectedHandle) {
    console.log("please select a directory");
    return;
  }

  let result = await selectedHandle.requestPermission({ mode: "readwrite" });
  if (result != 'granted') {
    console.log("site needs write access to save to this directory");
    return;
  }

  await clearDirectory(selectedHandle);
  await copyDirectory(await getOpfsDbHandle(), selectedHandle);
});

const saveElsewhereButton = document.getElementById("save_elsewhere_button");
saveElsewhereButton.addEventListener("click", async () => {
  let dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });

  await clearDirectory(dirHandle);
  await copyDirectory(await getOpfsDbHandle(), dirHandle);
});

const clearButton = document.getElementById("clear_button");
clearButton.addEventListener("click", async () => {
  const opfsRoot = await navigator.storage.getDirectory();

  // TODO: Close the database before trying to clear it.
  // Currently, this fails due to a locking error.
  await opfsRoot.removeEntry(dbName, { recursive: true });
});

async function getOpfsDbHandle() {
  let opfsRoot = await navigator.storage.getDirectory();
  return await opfsRoot.getDirectoryHandle(dbName, { create: true });
}

async function clearDirectory(handle: FileSystemDirectoryHandle) {
  for await (const child of handle.values()) {
    handle.removeEntry(child.name, { recursive: true });
  }
}

async function copyDirectory(source: FileSystemDirectoryHandle, dest: FileSystemDirectoryHandle) {
  for await (const child of source.values()) {
    if (child.kind == 'directory') {
      let destChildDir = await dest.getDirectoryHandle(child.name, { create: true });
      copyDirectory(child, destChildDir);
    } else {
      let destChildFile = await dest.getFileHandle(child.name, { create: true });
      copyFile(child, destChildFile);
    }
  }
}

async function copyFile(source: FileSystemFileHandle, dest: FileSystemFileHandle) {
  const sourceFile = await source.getFile();
  const destWritable = await dest.createWritable();
  await sourceFile.stream().pipeTo(destWritable);
  console.log("copyied: ", source.name);
}

const getButton = document.getElementById('get');
getButton.addEventListener('click', async () => {
  const keyInput = document.getElementById('get_key') as HTMLInputElement;
  const resultSpan = document.getElementById('get_result') as HTMLSpanElement;

  try {
    resultSpan.textContent = await db.get(keyInput.value);
  } catch (e) {
    resultSpan.textContent = `${e.name}: ${e.message}`;
    console.error(e);
  }
});

const putButton = document.getElementById('put');
putButton.addEventListener('click', async () => {
  const keyInput = document.getElementById('put_key') as HTMLInputElement;
  const valueInput = document.getElementById('put_value') as HTMLInputElement;
  const resultSpan = document.getElementById('put_result') as HTMLSpanElement;

  try {
    await db.put(keyInput.value, valueInput.value);
    resultSpan.textContent = 'Done';
    refreshIteratorTable(await iteratorTop.valid() ? await iteratorTop.key() : undefined);
  } catch (e) {
    resultSpan.textContent = `${e.name}: ${e.message}`;
    console.error(e);
  }
});

const deleteButton = document.getElementById('delete') as HTMLInputElement;
deleteButton.addEventListener('click', async () => {
  const keyInput = document.getElementById('delete_key') as HTMLInputElement;
  const resultSpan = document.getElementById('delete_result') as HTMLSpanElement;

  try {
    await db.remove(keyInput.value);
    resultSpan.textContent = 'Done';
    refreshIteratorTable(await iteratorTop.valid() ? await iteratorTop.key() : undefined);
  } catch (e) {
    resultSpan.textContent = `${e.name}: ${e.message}`;
    console.error(e);
  }
});

const iteratorTable = document.getElementById('table') as HTMLTableElement;
const iteratorPrevButton = document.getElementById('iterator_prev') as HTMLInputElement;
const iteratorNextButton = document.getElementById('iterator_next') as HTMLInputElement;

let iteratorTop = undefined;
let iteratorBottom = undefined;

const kIteratorStep = 10;

function tableFull() {
  return iteratorTable.rows.length == kIteratorStep + 1;
}

async function iteratorPrev() {
  await iteratorTop.prev();
  if (!await iteratorTop.valid()) {
    iteratorTop = await db.newIterator();
    await iteratorTop.seekToFirst();
    iteratorPrevButton.disabled = true;
    return false;
  }

  if (tableFull()) {
    await iteratorBottom.prev();
    iteratorNextButton.disabled = false;
    iteratorTable.deleteRow(-1);
  }

  const row = iteratorTable.insertRow(1);
  await populateRow(row, iteratorTop);
  return true;
}

iteratorPrevButton.value = `Previous ${kIteratorStep}`;
iteratorPrevButton.addEventListener('click', async () => {
  for (let i = 0; i < kIteratorStep; ++i) {
    if (!await iteratorPrev()) {
      break;
    }
  }
});

async function iteratorNext() {
  await iteratorBottom.next();
  if (!await iteratorBottom.valid()) {
    iteratorBottom = await db.newIterator();
    await iteratorBottom.seekToLast();
    iteratorNextButton.disabled = true;
    return false;
  }

  if (tableFull()) {
    await iteratorTop.next();
    iteratorPrevButton.disabled = false;
    iteratorTable.deleteRow(1);
  }

  const row = iteratorTable.insertRow(-1);
  await populateRow(row, iteratorBottom);
  return true;
}

iteratorNextButton.value = `Next ${kIteratorStep}`;
iteratorNextButton.addEventListener('click', async () => {
  for (let i = 0; i < kIteratorStep; ++i) {
    if (!await iteratorNext()) {
      break;
    }
  }
});

async function populateRow(row, iterator) {
  // Save the key from the iterator so it can be used by the delete button.
  const key = await iterator.key();
  const keyEl = document.createElement('td');
  keyEl.textContent = key;
  row.appendChild(keyEl);

  const valueEl = document.createElement('td');
  valueEl.textContent = await iterator.value();
  row.appendChild(valueEl);

  const deleteButton = document.createElement('input');
  deleteButton.type = 'button';
  deleteButton.value = 'Delete';
  deleteButton.addEventListener('click', async () => {
    const topKey = await iteratorTop.key();
    await db.remove(key);
    refreshIteratorTable(topKey);
  });
  row.appendChild(deleteButton);
}

async function refreshIteratorTable(startingKey = undefined) {
  while (iteratorTable.rows.length > 1) {
    iteratorTable.deleteRow(1);
  }

  iteratorPrevButton.disabled = false;
  iteratorNextButton.disabled = false;

  iteratorTop = await db.newIterator();
  iteratorBottom = await db.newIterator();

  if (startingKey) {
    await iteratorTop.seek(startingKey);
    await iteratorBottom.seek(startingKey);
  } else {
    await iteratorTop.seekToFirst();
    await iteratorBottom.seekToFirst();
  }

  if (iteratorBottom.valid()) {
    const row = iteratorTable.insertRow(-1);
    await populateRow(row, iteratorBottom);

    for (let i = 0; i < kIteratorStep - 1; ++i) {
      await iteratorNext();
    }
  }
}

// Populate the initial entries in the table.
refreshIteratorTable();
