import { LevelDb } from './leveldb_db.js';
import { Iterator } from './leveldb_iterator.js';

const dbName = 'db';
let db: LevelDb = new LevelDb('/opfs/' + dbName);

let selectedHandle: FileSystemDirectoryHandle | undefined;

const openButton = document.getElementById("open_button");
openButton.addEventListener("click", async () => {
  selectedHandle = await window.showDirectoryPicker();

  // Close the DB before attempting to copy any files.
  // Otherwise, this may fail due to a locking error.
  await closeDatabase();

  let dbHandle = await getOpfsDbHandle();
  await clearDirectory(dbHandle);
  await copyDirectory(selectedHandle, dbHandle);
  await refreshIteratorTable();
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
  // Close the DB before attempting to copy any files.
  // Otherwise, this may fail due to a locking error.
  await closeDatabase();

  const opfsRoot = await navigator.storage.getDirectory();
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
}

const generateDataButton = document.getElementById('generate_data');
generateDataButton.addEventListener('click', async () => {
  const data = [];
  for (let i = 0; i < 1000; ++i) {
    const key = i.toString(10).padStart(4, '0');
    const value = i.toString(16);
    data.push([key, value]);
  }
  await db.putMany(data);
  await refreshIteratorTable();
});

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
    refreshIteratorTable(iteratorTop.valid ? iteratorTop.key : undefined);
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
    refreshIteratorTable(iteratorTop.valid ? iteratorTop.key : undefined);
  } catch (e) {
    resultSpan.textContent = `${e.name}: ${e.message}`;
    console.error(e);
  }
});

const iteratorTable = document.getElementById('table') as HTMLTableElement;
const iteratorPrevButton = document.getElementById('iterator_prev') as HTMLInputElement;
const iteratorNextButton = document.getElementById('iterator_next') as HTMLInputElement;

let iteratorTop: Iterator | undefined;
let iteratorBottom: Iterator | undefined;

const kIteratorStep = 10;

function tableFull() {
  return iteratorTable.rows.length == kIteratorStep + 1;
}

async function iteratorPrev() {
  await iteratorTop.prev();
  if (!iteratorTop.valid) {
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
  populateRow(row, iteratorTop);
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
  if (!iteratorBottom.valid) {
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
  populateRow(row, iteratorBottom);
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

function populateRow(row: HTMLTableRowElement, iterator: Iterator) {
  // Save the key from the iterator so it can be used by the delete button.
  const key = iterator.key;
  const keyEl = document.createElement('td');
  keyEl.textContent = key;
  row.appendChild(keyEl);

  const valueEl = document.createElement('td');
  valueEl.textContent = iterator.value;
  row.appendChild(valueEl);

  const deleteButton = document.createElement('input');
  deleteButton.type = 'button';
  deleteButton.value = 'Delete';
  deleteButton.addEventListener('click', async () => {
    const topKey = iteratorTop.key;
    await db.remove(key);
    refreshIteratorTable(topKey);
  });
  row.appendChild(deleteButton);
}

async function refreshIteratorTable(startingKey: string | undefined = undefined) {
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

  if (iteratorBottom.valid) {
    const row = iteratorTable.insertRow(-1);
    populateRow(row, iteratorBottom);

    for (let i = 0; i < kIteratorStep - 1; ++i) {
      await iteratorNext();
    }
  }
}

async function closeDatabase() {
  iteratorPrevButton.disabled = true;
  iteratorNextButton.disabled = true;
  while (iteratorTable.rows.length > 1) {
    iteratorTable.deleteRow(1);
  }

  await db.close();
}

// Populate the initial entries in the table.
refreshIteratorTable();
