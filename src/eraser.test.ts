import{it,expect}from'vitest';import{eraseInk,eraseInkSweep}from'./eraser';import type{Stroke}from'./core';
const line:Stroke={id:'a',points:[[0,50],[100,50]],width:2,color:'#123'};
it('ordinary eraser removes only the touched part of a sparse stroke',()=>{const result=eraseInk([line],[50,50],10,'pixel');expect(result).toHaveLength(2);expect(result[0].points.at(-1)![0]).toBeCloseTo(40);expect(result[1].points[0][0]).toBeCloseTo(60);expect(result.every(s=>s.width===2&&s.color==='#123')).toBe(true);expect(line.points).toEqual([[0,50],[100,50]])});
it('stroke eraser detects intersections between samples and removes the entire stroke',()=>{expect(eraseInk([line],[50,50],10,'stroke')).toEqual([])});
it('keeps untouched ink and accounts for the page aspect ratio',()=>{expect(eraseInk([line],[50,65],10,'pixel')[0]).toBe(line);expect(eraseInk([line],[50,56],10,'stroke',2)[0]).toBe(line)});
it('continuous erasing does not skip ink when the pointer moves quickly',()=>{const result=eraseInkSweep([line],[30,20],[30,80],5,'pixel');expect(result).toHaveLength(2);expect(result[0].points.at(-1)![0]).toBeLessThan(31);expect(result[1].points[0][0]).toBeGreaterThan(29)});
it('erases dots without affecting other strokes',()=>{const dot={...line,id:'dot',points:[[200,200]]};expect(eraseInk([line,dot],[200,200],10,'pixel')).toEqual([line])});
