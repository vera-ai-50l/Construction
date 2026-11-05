// Sample the already-rendered Runner canvas. No second WebGL render, camera
// permissions, audio, or HUD capture is needed.
export class BodycamCapture {
  constructor(link, job) {
    this.link = link;
    this.job = job;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.next = 0;
    this.seq = 0;
  }

  sample(source) {
    const link = this.link, now = performance.now();
    if (!link || !this.ctx || this.busy || now < this.next || !link.canSendBodycam()) return;
    const room = link.kind === 'room';
    this.next = now + (room ? 330 : 125);
    const budget = link.bodycamBudget();
    if (budget < 820 || !source.width || !source.height) return;
    const canvas = this.canvas;
    const scale = Math.min((room ? 120 : 320) / source.width, (room ? 68 : 180) / source.height, 1);
    const w = Math.max(1, Math.round(source.width * scale)), h = Math.max(1, Math.round(source.height * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    this.ctx.drawImage(source, 0, 0, w, h);
    this.busy = true;
    const encode = (quality, retry) => {
      canvas.toBlob((blob) => {
        if (!this.link || !blob) { this.busy = false; return; }
        if (Math.ceil(blob.size / 3) * 4 > budget) {
          if (retry) {
            const smaller = document.createElement('canvas');
            smaller.width = Math.max(1, Math.round(w * 0.6));
            smaller.height = Math.max(1, Math.round(h * 0.6));
            smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
            canvas.width = smaller.width;
            canvas.height = smaller.height;
            this.ctx.drawImage(smaller, 0, 0);
            encode(0.24, false);
          } else this.busy = false;
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          this.busy = false;
          if (!this.link || typeof reader.result !== 'string') return;
          const jpeg = reader.result.slice(reader.result.indexOf(',') + 1);
          this.link.sendBodycam({ job: this.job, n: ++this.seq, jpeg });
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality);
    };
    encode(room ? 0.34 : 0.62, true);
  }

  dispose() { this.link = null; }
}
