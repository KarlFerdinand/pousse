// Génère rappels.ics à partir des horaires de data.js : node build-ics.js
const fs = require('fs'), path = require('path'), { MOMENTS } = require('./data.js');
const start = '20261110';
const tz = ['BEGIN:VTIMEZONE','TZID:Europe/Paris','BEGIN:DAYLIGHT','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','TZNAME:CEST','DTSTART:19700329T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','TZNAME:CET','DTSTART:19701025T030000','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
const ev = (uid, summary, desc, date, hm, rule) => ['BEGIN:VEVENT',`UID:pousse-${uid}@pousse.app`,`DTSTAMP:${start}T000000Z`,`DTSTART;TZID=Europe/Paris:${date}T${hm}00`,'DURATION:PT15M',`RRULE:${rule}`,`SUMMARY:${summary}`,`DESCRIPTION:${desc}`,'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${summary}`,'TRIGGER:PT0M','END:VALARM','END:VEVENT'];
const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pousse//FR','CALSCALE:GREGORIAN',...tz];
MOMENTS.forEach(m => lines.push(...ev(m.id, `Pousse : ${m.label}`, 'Une photo et quelques mots dans Pousse.', start, m.h.replace(':',''), 'FREQ=DAILY')));
lines.push(...ev('frigo', 'Pousse : photo du frigo et courses', 'Mets le frigo à jour puis regarde la liste de courses.', '20261115', '1000', 'FREQ=WEEKLY;BYDAY=SU'));
lines.push('END:VCALENDAR');
fs.writeFileSync(path.join(__dirname, 'rappels.ics'), lines.join('\r\n') + '\r\n');
