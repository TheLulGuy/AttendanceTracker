/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.js', './components/**/*.js', './lib/**/*.js'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0A0E13',
        panel: '#121821',
        panel2: '#161D27',
        border: '#222C38',
        ink: '#E6EDF3',
        muted: '#7C8B9B',
        muted2: '#566373',
        cyan: '#2DD4BF',
        cyandim: '#0E3833',
        amber: '#F2A93B',
        amberdim: '#3A2C12',
        red: '#E5484D',
        reddim: '#3A1418',
        violet: '#9B8CF2',
        violetdim: '#241F3A',
        holidaybg: '#1A2129',
        track: '#1A2129',
        holidaydot: '#3A4654',
        presentbadge: '#0a2820',
        absentbadge: '#2a0f10',
      },
      fontFamily: {
        sans: ['SpaceGrotesk'],
        mono: ['IBMPlexMono-Regular'],
        'mono-medium': ['IBMPlexMono-Medium'],
        'mono-semibold': ['IBMPlexMono-SemiBold'],
        'mono-bold': ['IBMPlexMono-Bold'],
      },
    },
  },
  plugins: [],
};
