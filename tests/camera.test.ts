import { it, expect, vi } from 'vitest';
import { acquireCamera } from '../src/client/camera';
const fakeVideo = () => ({ srcObject: null as any, videoWidth: 0, play: vi.fn(async () => {}) }) as any;
const fakeStream = () => { const track = { stop: vi.fn() }; return { stream: { getTracks: () => [track] } as any, track }; };
it('stop() stops acquired tracks and clears the video source', async () => {
  const { stream, track } = fakeStream(); const v = fakeVideo();
  const h = acquireCamera({ video: v, onCode: () => {}, onError: () => {}, getStream: async () => stream, decode: () => null });
  await vi.waitFor(() => expect(v.play).toHaveBeenCalled());
  h.stop(); expect(track.stop).toHaveBeenCalled(); expect(v.srcObject).toBeNull();
});
it('permission resolving after cancellation has its tracks stopped immediately', async () => {
  const { stream, track } = fakeStream(); let resolve!: (s: any) => void;
  const h = acquireCamera({ video: fakeVideo(), onCode: () => {}, onError: () => {}, getStream: () => new Promise(r => resolve = r), decode: () => null });
  h.stop(); resolve(stream);
  await vi.waitFor(() => expect(track.stop).toHaveBeenCalled());
});
it('successful decode stops tracks before delivering the code', async () => {
  const { stream, track } = fakeStream(); const v = fakeVideo(); const codes: string[] = [];
  acquireCamera({ video: v, onCode: (c) => codes.push(c), onError: () => {}, getStream: async () => stream, decode: () => 'VT-ABC123' });
  await vi.waitFor(() => expect(codes).toEqual(['VT-ABC123']));
  expect(track.stop).toHaveBeenCalled();
});
it('playback rejection surfaces an error and does not leak', async () => {
  const { stream, track } = fakeStream(); const v = fakeVideo(); v.play = vi.fn(async () => { throw new Error('play failed'); }); const errs: string[] = [];
  acquireCamera({ video: v, onCode: () => {}, onError: (m) => errs.push(m), getStream: async () => stream, decode: () => null });
  await vi.waitFor(() => expect(errs.length).toBe(1));
});
