import { fmt, addDays } from './dates';

export const EMPTY_CONFIG = {
  semStart: fmt(new Date()),
  semEnd: addDays(fmt(new Date()), 120),
  threshold: 75,
  holidays: [],
  exams: [],
  schedule: { 1:[], 2:[], 3:[], 4:[], 5:[] },
};

export const DEFAULT_CONFIG = {
  semStart: '2026-06-29',
  semEnd:   '2026-11-07',
  threshold: 75,
  holidays: [
    { date:'2026-09-14', label:'Vinayaka Chaturthi' },
    { date:'2026-10-02', label:'Gandhi Jayanthi' },
    { date:'2026-10-20', label:'Vijayadasami' },
  ],
  exams: [
    { name:'Sessional 1', startDate:'2026-08-18', endDate:'2026-08-28' },
  ],
  schedule: {
    1: [
      { key:'m1', time:'09:00', course:'EECE3051', label:'24EECE3051' },
      { key:'m2', time:'10:00', course:'CIVL1011',  label:'CIVL1011'   },
      { key:'m3', time:'11:00', course:'AERO2091',  label:'24AERO2091' },
      { key:'m4', time:'14:00', course:'EECE3071',  label:'24EECE3071' },
    ],
    2: [
      { key:'t1', time:'08:00', course:'EECE3011',  label:'24EECE3011'  },
      { key:'t2', time:'09:00', course:'EECE3071',  label:'24EECE3071'  },
      { key:'t3', time:'10:00', course:'CIVL1011',  label:'CIVL1011'    },
      { key:'t4', time:'11:00', course:'EECE3041',  label:'24EECE3041'  },
      { key:'t5', time:'12:00', course:'AERO2091',  label:'24AERO2091'  },
      { key:'t6', time:'14:00', course:'EECE3071P', label:'24EECE3071P' },
      { key:'t7', time:'15:00', course:'EECE3071P', label:'24EECE3071P' },
    ],
    3: [
      { key:'w1', time:'09:00', course:'EECE3041', label:'24EECE3041' },
      { key:'w2', time:'10:00', course:'CIVL1011',  label:'CIVL1011'   },
      { key:'w3', time:'11:00', course:'EECE3071',  label:'24EECE3071' },
      { key:'w4', time:'12:00', course:'EECE3051',  label:'24EECE3051' },
    ],
    4: [
      { key:'h1', time:'09:00', course:'AERO2091', label:'24AERO2091' },
      { key:'h2', time:'11:00', course:'EECE3011', label:'24EECE3011' },
      { key:'h3', time:'12:00', course:'EECE3041', label:'24EECE3041' },
    ],
    5: [
      { key:'f1', time:'08:00', course:'GCGC1021',  label:'GCGC1021'    },
      { key:'f2', time:'09:00', course:'GCGC1021',  label:'GCGC1021'    },
      { key:'f3', time:'11:00', course:'EECE3051',  label:'24EECE3051'  },
      { key:'f4', time:'14:00', course:'EECE3011P', label:'24EECE3011P' },
      { key:'f5', time:'15:00', course:'EECE3011P', label:'24EECE3011P' },
    ],
  },
};
