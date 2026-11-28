import {it,expect} from 'vitest';
import {inkPath} from './ink-path';
it('renders taps and short strokes immediately',()=>{
  expect(inkPath([])).toBe('');
  expect(inkPath([[3,4]])).toBe('M3,4l0.05,0.05');
  expect(inkPath([[3,4],[8,9]])).toBe('M3,4L8,9');
});
it('smooths bends while preserving the exact start and final pen position',()=>{
  const points:[number,number][]=[[0,0],[10,20],[20,10],[30,30]];
  expect(inkPath(points)).toBe('M0,0Q10,20 15,15Q20,10 25,20L30,30');
  expect(points).toHaveLength(4);
});

import {smoothInkPoints} from './ink-path';
it('increases jitter reduction with the smoothing setting and leaves source points intact',()=>{
  const points=Array.from({length:25},(_,i)=>[i*10,i%2?8:-8]);
  const before=JSON.stringify(points);
  const roughness=(p:readonly (readonly number[])[])=>p.slice(4,-4).reduce((sum,point)=>sum+Math.abs(point[1]),0);
  expect(smoothInkPoints(points,0)).toBe(points);
  expect(roughness(smoothInkPoints(points,1))).toBeLessThan(roughness(smoothInkPoints(points,.2)));
  expect(smoothInkPoints(points,1)[0]).toEqual(points[0]);
  expect(smoothInkPoints(points,1).at(-1)).toEqual(points.at(-1));
  expect(JSON.stringify(points)).toBe(before);
});
