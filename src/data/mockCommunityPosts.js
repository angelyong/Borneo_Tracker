// Seed content for the Community page. Kept as plain, immutable data — all
// runtime mutations (new posts, likes, comments) live in the persisted overlay
// inside communityService.js, never here. This keeps the seed set easy to
// read/extend without touching any state logic.

export const TOPIC_OPTIONS = [
  'Environment',
  'Wildlife',
  'Culture & Heritage',
  'Livelihoods',
  'Infrastructure',
  'General',
];

export const TERRITORY_OPTIONS = ['All Borneo', 'Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];

export const mockCommunityPosts = [
  {
    id: 'seed-1',
    author: 'Amirul H.',
    territory: 'Sabah',
    topic: 'Wildlife',
    title: 'Orangutan sighting near Kinabatangan — populations rebounding?',
    body:
      "Spent the weekend along the Kinabatangan river and counted more orangutan nests than last year's trip. Anyone from the local wildlife groups tracking whether the riparian reforestation corridors are actually helping, or is this just a good week?",
    createdAt: '2026-07-06T09:15:00+08:00',
    likeCount: 24,
    comments: [
      {
        id: 'seed-1-c1',
        author: 'Dr. Lim S.Y.',
        body: 'The Kinabatangan Corridor of Life project has published a small uptick in nest density in the last survey — encouraging but still early data.',
        createdAt: '2026-07-06T11:02:00+08:00',
        likeCount: 9,
      },
      {
        id: 'seed-1-c2',
        author: 'Faridah K.',
        body: 'Saw the same thing near Bilit! Hoping it holds up through the dry season.',
        createdAt: '2026-07-06T13:40:00+08:00',
        likeCount: 3,
      },
    ],
  },
  {
    id: 'seed-2',
    author: 'Dayang R.',
    territory: 'Sarawak',
    topic: 'Culture & Heritage',
    title: 'Gawai Dayak prep — which longhouses are open to visitors this year?',
    body:
      "Planning to bring some exchange students to experience Gawai properly this year instead of just the touristy version in town. Looking for longhouse communities near Kapit or Song that welcome respectful visitors during the harvest festival.",
    createdAt: '2026-07-04T18:20:00+08:00',
    likeCount: 31,
    comments: [
      {
        id: 'seed-2-c1',
        author: 'Jerome A.',
        body: "Rumah Gare near Song has hosted student groups before, just reach out to the tuai rumah ahead of time.",
        createdAt: '2026-07-04T19:05:00+08:00',
        likeCount: 6,
      },
    ],
  },
  {
    id: 'seed-3',
    author: 'Nurul A.',
    territory: 'Kalimantan',
    topic: 'Livelihoods',
    title: 'Smallholder palm oil farmers and the EUDR deadline — real talk',
    body:
      "With the EU deforestation rule deadline at the end of this year, a lot of smallholders in our koperasi still don't have plot-level geolocation done. Has anyone actually gotten help from a local agency, or are we all figuring this out alone?",
    createdAt: '2026-07-03T08:47:00+08:00',
    likeCount: 42,
    comments: [
      {
        id: 'seed-3-c1',
        author: 'Bambang S.',
        body: "Our koperasi in Kalimantan Barat got a free GPS-mapping session through a cooperative extension program. Worth asking your local Dinas Perkebunan office.",
        createdAt: '2026-07-03T10:12:00+08:00',
        likeCount: 14,
      },
      {
        id: 'seed-3-c2',
        author: 'Nurul A.',
        body: 'Thank you, will follow up on this this week.',
        createdAt: '2026-07-03T10:40:00+08:00',
        likeCount: 2,
      },
    ],
  },
  {
    id: 'seed-4',
    author: 'Hj. Rosli',
    territory: 'Brunei',
    topic: 'Infrastructure',
    title: 'Kampong Ayer clean water upgrades — noticeably better this year',
    body:
      "Water pressure in our part of Kampong Ayer has been much more consistent since the pipe replacement work finished. Small thing but it makes a real difference day to day. Curious if other water villages have seen the same improvement.",
    createdAt: '2026-07-02T20:05:00+08:00',
    likeCount: 18,
    comments: [],
  },
  {
    id: 'seed-5',
    author: 'Chong W.M.',
    territory: 'All Borneo',
    topic: 'Environment',
    title: 'Haze season starting early this year?',
    body:
      "Air quality in a few of my usual check-ins has dipped earlier than usual this month. Is this just localised burning or is anyone else seeing a wider trend across the island? Would help to compare notes across territories.",
    createdAt: '2026-06-29T07:30:00+08:00',
    likeCount: 37,
    comments: [
      {
        id: 'seed-5-c1',
        author: 'Amirul H.',
        body: "Sabah's been mostly clear so far, but I've heard Kalimantan side is starting to see it.",
        createdAt: '2026-06-29T09:00:00+08:00',
        likeCount: 5,
      },
    ],
  },
  {
    id: 'seed-6',
    author: 'Grace T.',
    territory: 'Sarawak',
    topic: 'General',
    title: 'Anyone else using the Resilience Index to explain "true wealth" to their kids?',
    body:
      "Been showing my daughter the Hexagon score for our region instead of just talking about money and GDP. She actually gets it — food, energy, healthcare are things she can see around her. Curious how other parents/teachers are using it.",
    createdAt: '2026-06-27T15:12:00+08:00',
    likeCount: 29,
    comments: [
      {
        id: 'seed-6-c1',
        author: 'Teacher Wong',
        body: 'Using something similar in a geography class exercise — students respond much better to it than raw GDP tables.',
        createdAt: '2026-06-27T16:48:00+08:00',
        likeCount: 11,
      },
    ],
  },
];
