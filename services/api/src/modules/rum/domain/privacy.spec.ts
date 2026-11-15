import { enforceReplayPrivacy, maskText, sampled, stripFormValues } from './privacy';

describe('replay privacy', () => {
  it('removes password, card and textarea values even if the tag missed them', () => {
    const html =
      '<form><input type="password" value="hunter2"><input name="cc" value=\'4242 4242 4242 4242\'>' +
      '<input type=checkbox checked><textarea>secret note</textarea></form>';
    const out = stripFormValues(html);
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('4242');
    expect(out).not.toContain('secret note');
    expect(out).not.toContain('checked');
  });

  it('masks every visible character but keeps styles', () => {
    const html = '<style>.a{color:red}</style><p>Card 4242 for Ann</p><script>x()</script>';
    const out = maskText(html);
    expect(out).toContain('.a{color:red}');
    expect(out).not.toContain('Ann');
    expect(out).not.toContain('4242');
    expect(out).toContain('<p>•••• •••• ••• •••</p>');
  });

  it('applies masking only when the application asks for it', () => {
    expect(enforceReplayPrivacy('<b>Hi</b>', false)).toBe('<b>Hi</b>');
    expect(enforceReplayPrivacy('<b>Hi</b>', true)).toBe('<b>••</b>');
  });

  it('samples sessions deterministically', () => {
    expect(sampled('abc', 1)).toBe(true);
    expect(sampled('abc', 0)).toBe(false);
    expect(sampled('abc', 0.5)).toBe(sampled('abc', 0.5));
    const hits = Array.from({ length: 2000 }, (_, i) => sampled(`s${i}`, 0.25)).filter(Boolean);
    expect(hits.length).toBeGreaterThan(400);
    expect(hits.length).toBeLessThan(600);
  });
});
