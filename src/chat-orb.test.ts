import{it,expect}from'vitest';import{clampOrbPosition}from'./chat-orb';
it('keeps the chat orb accessible after dragging and viewport changes',()=>{expect(clampOrbPosition({x:-200,y:10000},400,800)).toEqual({x:10,y:734});expect(clampOrbPosition({x:900,y:500},320,600)).toEqual({x:254,y:500});expect(clampOrbPosition({x:100,y:120},400,800)).toEqual({x:100,y:120})});
it('rejects invalid persisted positions without losing the orb offscreen',()=>{expect(clampOrbPosition({x:NaN,y:Infinity},400,800)).toEqual({x:10,y:10});expect(clampOrbPosition({x:50,y:50},40,40)).toEqual({x:10,y:10})});
