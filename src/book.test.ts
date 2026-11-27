import{it,expect}from'vitest';import{pageTurnGesture}from'./book';
const start={x:300,y:200,time:0};
it('recognizes intentional horizontal swipes in either direction',()=>{expect(pageTurnGesture(start,{x:100,y:210,time:300},100)).toBe(1);expect(pageTurnGesture(start,{x:500,y:210,time:300},100)).toBe(-1)});
it('keeps scrolling, small motions, slow gestures and zoomed panning from turning the page',()=>{for(const end of[{x:290,y:400,time:200},{x:260,y:200,time:200},{x:100,y:200,time:1200}])expect(pageTurnGesture(start,end,100)).toBe(0);expect(pageTurnGesture(start,{x:100,y:200,time:300},150)).toBe(0)});

import{resolveBookFold}from'./book';
it('allows a new note page from the last corner without adding to imported documents',()=>{expect(resolveBookFold(3,4,true,1)).toEqual({target:4,addPage:true});expect(resolveBookFold(3,4,false,1)).toBeNull();expect(resolveBookFold(1,4,true,1)).toEqual({target:2,addPage:false});expect(resolveBookFold(0,4,true,-1)).toBeNull()});
