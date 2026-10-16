import app from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`[DevTrack Backend] Server running on http://localhost:${env.PORT}`);
});
