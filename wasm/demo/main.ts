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
  } catch (e) {
    resultSpan.textContent = `${e.name}: ${e.message}`;
    console.error(e);
  }
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
