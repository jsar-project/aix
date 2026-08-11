import ora from "ora";

export async function withLoading<T>(
  message: string,
  task: () => Promise<T>,
): Promise<T> {
  if (!process.stderr.isTTY) {
    return await task();
  }

  const spinner = ora({
    text: message,
    stream: process.stderr,
  });

  spinner.start();
  try {
    const result = await task();
    spinner.stop();
    return result;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}
