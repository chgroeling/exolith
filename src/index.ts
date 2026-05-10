import { run } from './cli/main';

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}

export { buildIngestFactory } from './composition/root';
