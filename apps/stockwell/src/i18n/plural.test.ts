import { describe, expect, it } from 'vitest';
import { translate } from './index';

// A numeric `count` picks key_one / key_other (the "Add N more photos" hint showed the raw key).
describe('translate plurals', () => {
  it('picks _one / _other from count, in both languages', () => {
    expect(translate('en', 'media.needMore', { count: 1 })).toBe(
      'Add 1 more photo to publish this product. Videos don’t count.',
    );
    expect(translate('en', 'media.needMore', { count: 3 })).toContain('Add 3 more photos');
    expect(translate('te', 'media.needMore', { count: 2 })).toContain('2');
    expect(translate('te', 'media.needMore', { count: 2 })).not.toBe('media.needMore');
  });

  it('still resolves plain keys, and keys that only exist without a plural form', () => {
    expect(translate('en', 'media.photosTitle')).toBe('Photos');
    expect(translate('en', 'media.photoCount', { n: 2, min: 3, count: 2 })).toBe(
      'Photos: 2 / 3 minimum',
    );
  });
});
