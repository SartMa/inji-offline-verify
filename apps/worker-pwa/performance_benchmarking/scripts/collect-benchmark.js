import { chromium, errors as playwrightErrors } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG = path.join(__dirname, 'benchmark-config.json');
const DEFAULT_CREDENTIALS = {
  orgName: 'AcmeCorp10',
  username: 'sunsun',
  password: '12345678',
};

function parseDuration(text) {
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)ms/);
  return match ? Number(match[1]) : null;
}

function parseCliFlags(rawArgs) {
  return rawArgs.reduce((acc, arg) => {
    if (!arg.startsWith('--')) return acc;
    const [key, value] = arg.slice(2).split('=');
    acc[key] = value ?? 'true';
    return acc;
  }, {});
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const totalSeconds = Math.round(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function computeStats(values) {
  if (!values.length) {
    return { samples: 0, average: null, min: null, max: null }; 
  }
  const total = values.reduce((sum, v) => sum + v, 0);
  return {
    samples: values.length,
    average: Number((total / values.length).toFixed(2)),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

async function ensureConfig(configPath) {
  try {
    await fs.access(configPath);
    return configPath;
  } catch {
    const template = {
      url: 'http://localhost:5173',
      iterations: 1,
      samples: [
        {
          name: 'Sample 1',
          file: '../benchmark-samples/image.png'
        },
        {
          name: 'Sample 2',
          file: '../benchmark-samples/image_3.png'
        },
        {
          name: 'Sample 3',
          file: '../benchmark-samples/image_5.png'
        },
        

      ],
  credentials: DEFAULT_CREDENTIALS,
      waitAfterUploadMs: 1500,
      outputDir: '../docs/run-snapshots'
    };
    await fs.writeFile(configPath, JSON.stringify(template, null, 2), 'utf-8');
    throw new Error(`Benchmark config not found. A starter template has been created at ${configPath}. Update the file with your QR sample paths and re-run.`);
  }
}

async function ensureAuthenticated(page, credentials, dashboardUrl) {
  const uploadLocator = page.locator('text=Upload File').first();
  const waitForUploadCard = async (timeout = 20_000) => {
    try {
      await uploadLocator.waitFor({ timeout });
      return true;
    } catch (error) {
      if (error instanceof playwrightErrors.TimeoutError) {
        return false;
      }
      throw error;
    }
  };

  if (await waitForUploadCard(5_000)) {
    return;
  }

  if (dashboardUrl) {
    try {
      await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
      if (await waitForUploadCard(5_000)) {
        return;
      }
    } catch (error) {
      console.warn('Initial dashboard load failed, will attempt sign-in flow.', error);
    }
  }

  try {
    await page.waitForSelector('text=Sign in', { timeout: 30_000 });
  } catch (error) {
    if (error instanceof playwrightErrors.TimeoutError) {
      throw new Error('Timed out waiting for sign-in screen to appear.');
    }
    throw error;
  }

  console.log('Signing in with worker credentials...');
  await page.waitForSelector('input[name="organization"]', { timeout: 20_000 });
  await page.fill('input[name="organization"]', '');
  await page.fill('input[name="organization"]', credentials.orgName ?? '');
  await page.fill('input[name="username"]', '');
  await page.fill('input[name="username"]', credentials.username ?? '');
  await page.fill('input[name="password"]', '');
  await page.fill('input[name="password"]', credentials.password ?? '');
  await page.click('button:has-text("Sign in")');

  const outcome = await Promise.race([
    page
      .waitForURL('**/dashboard', { timeout: 30_000 })
      .then(() => ({ type: 'success' }))
      .catch((error) => {
        if (error instanceof playwrightErrors.TimeoutError) {
          return { type: 'timeout', error };
        }
        throw error;
      }),
    page
      .waitForSelector('role=alert', { timeout: 30_000 })
      .then(async (handle) => ({ type: 'toast', text: (await handle.innerText())?.trim() ?? '' }))
      .catch((error) => {
        if (error instanceof playwrightErrors.TimeoutError) {
          return { type: 'toast-timeout' };
        }
        throw error;
      }),
  ]);

  if (outcome?.type === 'toast' && outcome.text.toLowerCase().includes('login failed')) {
    throw new Error(`Login failed for ${credentials.username}@${credentials.orgName}: ${outcome.text}`);
  }

  if (outcome?.type === 'timeout') {
    throw new Error(`Timed out waiting for dashboard after sign-in. Last error: ${outcome.error}`);
  }

  if (outcome?.type !== 'success') {
    try {
      await page.waitForURL('**/dashboard', { timeout: 20_000 });
    } catch (error) {
      if (error instanceof playwrightErrors.TimeoutError) {
        throw new Error('Sign-in appeared to succeed but dashboard did not load in time.');
      }
      throw error;
    }
  }

  if (dashboardUrl) {
    await page.goto(dashboardUrl, { waitUntil: 'networkidle' }).catch(() => {});
  }

  if (!(await waitForUploadCard())) {
    throw new Error('Upload card not found after successful sign-in.');
  }
}

async function main() {
  const argList = process.argv.slice(2);
  let configArg = argList.find((arg) => !arg.startsWith('--'));
  const configPath = configArg ? path.resolve(configArg) : DEFAULT_CONFIG;
  const cliOptions = parseCliFlags(argList);

  await ensureConfig(configPath);

  const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  const targetUrl = process.env.WORKER_PWA_URL ?? config.url ?? 'http://localhost:5173';
  const iterations = Math.max(1, Number(cliOptions.iterations ?? process.env.BENCHMARK_ITERATIONS ?? config.iterations ?? 1));
  const credentials = { ...DEFAULT_CREDENTIALS, ...(config.credentials ?? {}) };
  const waitAfterUploadMs = Number(cliOptions.waitAfterUploadMs ?? process.env.BENCHMARK_WAIT_AFTER_UPLOAD_MS ?? config.waitAfterUploadMs ?? 1500);
  const outputDir = path.resolve(__dirname, config.outputDir ?? '../docs/run-snapshots');
  const progressEvery = Math.max(1, Number(cliOptions.progressEvery ?? config.progressEvery ?? 50));

  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const performanceLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[Performance]')) {
      const entry = { time: new Date().toISOString(), text };
      performanceLogs.push(entry);
      console.log(`[browser] ${text}`);
    }
  });

  console.log(`Navigating to ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });

  const dashboardUrl = new URL('/dashboard', targetUrl).toString();

  await ensureAuthenticated(page, credentials, dashboardUrl);

  const uploadCard = page.locator('text=Upload File').first();
  await uploadCard.click();
  await page.waitForSelector('#file-upload-modal-input', { timeout: 10_000 });

  const results = [];

  const ensureUploadModalOpen = async () => {
    let input = await page.$('#file-upload-modal-input');
    if (input) {
      return input;
    }

    const verifyAnotherButton = page.locator('button:has-text("Verify Another Credential")').first();
    if (await verifyAnotherButton.count()) {
      await verifyAnotherButton.click();
    } else {
      await uploadCard.click();
    }

    await page.waitForSelector('#file-upload-modal-input', { timeout: 10_000 });
    input = await page.$('#file-upload-modal-input');

    if (!input) {
      throw new Error('File input not found after attempting to open upload modal.');
    }

    return input;
  };

  const workload = [];
  for (let i = 0; i < iterations; i += 1) {
    for (const sample of config.samples) {
      workload.push({ ...sample, iteration: i + 1 });
    }
  }

  const totalSamples = workload.length;
  let processedSamples = 0;
  const startedAt = Date.now();

  for (const sample of workload) {
    const samplePath = path.resolve(path.dirname(configPath), sample.file ?? '');
    console.log(`\nProcessing sample: ${sample.name} (iteration ${sample.iteration}) -> ${samplePath}`);

    try {
      await fs.access(samplePath);
    } catch (error) {
      console.error(`❌ Cannot read sample file for ${sample.name}: ${samplePath}`);
      results.push({ sample: sample.name, error: 'FILE_NOT_FOUND' });
      continue;
    }

    const verificationEvent = page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('[Performance] QR upload verification completed'),
      timeout: 30_000,
    });

    const storageEvent = page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('[Performance] Verification result stored'),
      timeout: 30_000,
    });

    const hybridEvent = page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('[Performance] Hybrid logs refresh (post-store-refresh)') && msg.text().includes('completed'),
      timeout: 30_000,
    });

    const input = await ensureUploadModalOpen();

    await input.setInputFiles(samplePath);

    const [verificationMsg, storageMsg, hybridMsg] = await Promise.all([
      verificationEvent.catch((error) => ({ error })),
      storageEvent.catch((error) => ({ error })),
      hybridEvent.catch((error) => ({ error })),
    ]);

    const verificationTimedOut = verificationMsg?.error instanceof playwrightErrors.TimeoutError;
    const storageTimedOut = storageMsg?.error instanceof playwrightErrors.TimeoutError;

    if (storageMsg?.error && !storageTimedOut) {
      console.error(`❌ Benchmark run failed for ${sample.name}. Storage event error:`, storageMsg.error);
      results.push({ sample: sample.name, error: 'STORAGE_ERROR' });
      continue;
    }

    if (storageTimedOut) {
      console.error(`❌ Benchmark run failed for ${sample.name}. Storage metrics not emitted within expected window.`);
      results.push({ sample: sample.name, error: 'STORAGE_TIMEOUT' });
      continue;
    }

    if (verificationMsg?.error && !verificationTimedOut) {
      console.error(`❌ Benchmark run failed for ${sample.name}. Verification event error:`, verificationMsg.error);
      results.push({ sample: sample.name, error: 'VERIFICATION_ERROR' });
      continue;
    }

    if (verificationTimedOut) {
      console.warn(`⚠️  Verification metrics not captured for ${sample.name}. Proceeding using storage log only.`);
    }

    const verificationMs = !verificationTimedOut && typeof verificationMsg?.text === 'function'
      ? parseDuration(verificationMsg.text())
      : null;
    const storageMs = typeof storageMsg?.text === 'function'
      ? parseDuration(storageMsg.text())
      : null;
    const hybridMs = !hybridMsg?.error && typeof hybridMsg?.text === 'function'
      ? parseDuration(hybridMsg.text())
      : null;

    results.push({
      sample: sample.name,
      file: sample.file,
      iteration: sample.iteration,
      verificationMs,
      storageMs,
      hybridRefreshMs: hybridMs,
    });

    // Close the result modal if it's visible

    const verifyAnotherButton = page.locator('button:has-text("Verify Another Credential")').first();
    if (await verifyAnotherButton.count()) {
      await verifyAnotherButton.click();
    }

    await page.waitForTimeout(waitAfterUploadMs);

    processedSamples += 1;
    if (processedSamples % progressEvery === 0 || processedSamples === totalSamples) {
      const elapsed = Date.now() - startedAt;
      const avgPerSample = elapsed / processedSamples;
      const remainingSamples = totalSamples - processedSamples;
      const etaMs = avgPerSample * remainingSamples;
      const percent = ((processedSamples / totalSamples) * 100).toFixed(2);
      console.log(`Progress: ${processedSamples}/${totalSamples} samples (${percent}%) processed. Elapsed ${formatDuration(elapsed)}, ETA ${formatDuration(etaMs)}.`);
    }
  }

  const totalElapsedMs = Date.now() - startedAt;
  console.log(`\nCompleted ${iterations} iteration(s) across ${totalSamples} samples in ${formatDuration(totalElapsedMs)}.`);

  const verificationStats = computeStats(results.filter((r) => r.verificationMs != null).map((r) => r.verificationMs));
  const storageStats = computeStats(results.filter((r) => r.storageMs != null).map((r) => r.storageMs));
  const hybridStats = computeStats(results.filter((r) => r.hybridRefreshMs != null).map((r) => r.hybridRefreshMs));

  const summary = {
    generatedAt: new Date().toISOString(),
    url: targetUrl,
    iterations,
    totalSamples,
    totalElapsedMs,
    samples: results,
    summary: {
      verification: verificationStats,
      storage: storageStats,
      hybridRefresh: hybridStats,
    },
    logs: performanceLogs,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `benchmark-run-${timestamp}.json`);
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf-8');

  console.log('\nBenchmark completed. Summary:');
  console.table(summary.summary);
  console.log(`\nDetailed log written to ${outputPath}`);

  await browser.close();
}

main().catch((error) => {
  console.error('Benchmark script failed:', error);
  process.exitCode = 1;
});
