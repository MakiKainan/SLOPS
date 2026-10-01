let preparing = false;

/** Wait for every tile; release the guard after cancellation or failure too. */
export async function printWhenReady(images: HTMLImageElement[], print: () => void) {
  if (preparing) return false;
  preparing = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!images.length) throw new Error('Add a sticker before printing.');
    await Promise.race([
      Promise.all(images.map(image => image.decode())),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Images are still loading. Please try again.')), 15000); }),
    ]);
    if (images.some(image => !image.naturalWidth)) throw new Error('A sticker could not be loaded. Add it to the sheet again.');
    print();
    return true;
  } finally {
    clearTimeout(timer);
    preparing = false;
  }
}
