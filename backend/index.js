import { createApp } from './app.js';

const app = createApp();
const port = 3001;

app.listen(port, () => {
  console.log(`CodeVisualizer API running at http://localhost:${port}`);
});
