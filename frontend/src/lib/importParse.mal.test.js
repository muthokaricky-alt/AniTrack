import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { parseMalXml, parseFile } from './importParse.js';

const ANIME_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_id>1</user_id><user_name>kyalo</user_name><user_export_type>1</user_export_type><user_total_anime>4</user_total_anime></myinfo>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title><![CDATA[Cowboy Bebop]]></series_title>
    <series_type>TV</series_type><series_episodes>26</series_episodes>
    <my_id>0</my_id><my_watched_episodes>26</my_watched_episodes>
    <my_score>9</my_score><my_status>Completed</my_status>
    <my_comments><![CDATA[Space jazz & noodles]]></my_comments>
  </anime>
  <anime>
    <series_animedb_id>16498</series_animedb_id>
    <series_title><![CDATA[Shingeki no Kyojin]]></series_title>
    <series_episodes>25</series_episodes><my_watched_episodes>10</my_watched_episodes>
    <my_score>0</my_score><my_status>Watching</my_status><my_comments><![CDATA[]]></my_comments>
  </anime>
  <anime>
    <series_animedb_id>5114</series_animedb_id>
    <series_title>Fullmetal Alchemist: Brotherhood &amp; Friends</series_title>
    <series_episodes>0</series_episodes><my_watched_episodes>0</my_watched_episodes>
    <my_score>8</my_score><my_status>Plan to Watch</my_status>
  </anime>
  <anime>
    <series_animedb_id>9253</series_animedb_id>
    <series_title><![CDATA[Steins;Gate]]></series_title>
    <series_episodes>24</series_episodes><my_watched_episodes>3</my_watched_episodes>
    <my_score>10</my_score><my_status>On-Hold</my_status>
  </anime>
  <anime>
    <series_animedb_id>30</series_animedb_id><series_title><![CDATA[Evangelion]]></series_title>
    <my_status>4</my_status><my_watched_episodes>5</my_watched_episodes><my_score>6</my_score>
  </anime>
</myanimelist>`;

const MANGA_XML = `<myanimelist>
  <manga>
    <manga_mangadb_id>2</manga_mangadb_id><manga_title><![CDATA[Berserk]]></manga_title>
    <manga_volumes>41</manga_volumes><manga_chapters>0</manga_chapters>
    <my_read_volumes>10</my_read_volumes><my_read_chapters>88</my_read_chapters>
    <my_score>10</my_score><my_status>Reading</my_status>
  </manga>
  <manga>
    <manga_mangadb_id>13</manga_mangadb_id><manga_title><![CDATA[One Piece]]></manga_title>
    <manga_chapters>0</manga_chapters><my_read_chapters>0</my_read_chapters>
    <my_score>0</my_score><my_status>Plan to Read</my_status>
  </manga>
</myanimelist>`;

test('reads an anime export: ids, titles, statuses, scores and progress', () => {
  const [sec] = parseMalXml(ANIME_XML);
  assert.equal(sec.kind, 'anime');
  assert.equal(sec.rows.length, 5);
  const [bebop, aot, fma, sg, eva] = sec.rows;
  assert.deepEqual({ ...bebop, genres: undefined, ratings: undefined }, {
    title: 'Cowboy Bebop', mal_id: 1, status: 'completed', score: 9, progress: 26, total: 26, review: 'Space jazz & noodles', genres: undefined, ratings: undefined
  });
  assert.equal(aot.status, 'active');
  assert.equal(aot.score, null); // 0 means "not scored"
  assert.equal(aot.review, null);
  assert.equal(fma.title, 'Fullmetal Alchemist: Brotherhood & Friends'); // entities decoded
  assert.equal(fma.status, 'plan');
  assert.equal(fma.total, null); // 0 episodes means unknown
  assert.equal(sg.status, 'on_hold');
  assert.equal(eva.status, 'dropped'); // numeric status codes work too
});

test('reads a manga export using chapters as progress', () => {
  const sections = parseMalXml(MANGA_XML);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].kind, 'manga');
  const [berserk, op] = sections[0].rows;
  assert.equal(berserk.mal_id, 2);
  assert.equal(berserk.progress, 88);
  assert.equal(berserk.status, 'active');
  assert.equal(berserk.total, null);
  assert.equal(op.status, 'plan');
});

test('ignores files that are not MyAnimeList exports', () => {
  assert.deepEqual(parseMalXml('<html><body>hello</body></html>'), []);
  assert.deepEqual(parseMalXml(''), []);
});

test('does not choke on odd or hostile input', () => {
  const evil = '<!DOCTYPE x [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;">]><myanimelist><anime><series_animedb_id>7</series_animedb_id><series_title>&b; &#x1F600; &#0; &unknown;</series_title></anime></myanimelist>';
  const [sec] = parseMalXml(evil);
  assert.equal(sec.rows.length, 1);
  assert.ok(!sec.rows[0].title.includes('aaaa')); // entities are never expanded
  assert.ok(sec.rows[0].title.includes('😀'));
});

const asFile = (name, data) => new File([data], name);

test('parseFile opens .xml and .xml.gz exports', async () => {
  const plain = await parseFile(asFile('animelist_1_-_1.xml', ANIME_XML));
  assert.equal(plain[0].rows.length, 5);
  const zipped = await parseFile(asFile('animelist_1_-_1.xml.gz', gzipSync(Buffer.from(ANIME_XML))));
  assert.equal(zipped[0].rows.length, 5);
});

test('parseFile gives clear errors for bad .gz and non-MAL xml', async () => {
  await assert.rejects(() => parseFile(asFile('x.xml.gz', Buffer.from('not gzip at all'))), /could not be unpacked/);
  await assert.rejects(() => parseFile(asFile('x.xml', '<foo></foo>')), /MyAnimeList export/);
});
