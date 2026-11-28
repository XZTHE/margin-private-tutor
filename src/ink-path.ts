type Point=readonly number[];
export function smoothInkPoints(points:readonly Point[],strength:number):readonly Point[]{
  const radius=Math.round(Math.max(0,Math.min(1,strength))*8);
  if(!radius||points.length<3)return points;
  return points.map((p,i)=>{
    if(i===0||i===points.length-1)return p;
    const window=Math.min(radius,i,points.length-1-i);
    let x=0,y=0,total=0;
    for(let j=-window;j<=window;j++){const weight=window+1-Math.abs(j);x+=points[i+j][0]*weight;y+=points[i+j][1]*weight;total+=weight;}
    return [x/total,y/total];
  });
}
export function inkPath(raw:readonly Point[],smoothing=0):string{
  const points=smoothInkPoints(raw,smoothing);
  if(!points.length)return '';
  const [first]=points;
  let path=`M${first[0]},${first[1]}`;
  if(points.length===1)return path+`l0.05,0.05`;
  for(let i=1;i<points.length-1;i++){
    const p=points[i],next=points[i+1];
    path+=`Q${p[0]},${p[1]} ${(p[0]+next[0])/2},${(p[1]+next[1])/2}`;
  }
  const last=points[points.length-1];
  return path+`L${last[0]},${last[1]}`;
}
