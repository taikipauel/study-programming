import path from 'path';
import { runTests } from '@vscode/test-electron';

const shouldRun = process.env.RUN_VSCODE_E2E === 'true';

(shouldRun ? test : test.skip)('runs VS Code extension e2e suite', async () => {
  const extensionDevelopmentPath = path.resolve(__dirname, '../../..');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath
  });
});
