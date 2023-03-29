import { LevelDb } from './leveldb_db.js';

const db = new LevelDb('hello_world');

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
