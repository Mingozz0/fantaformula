'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export function DeadlineRefresh({deadline}:{deadline:string}) {
  const router=useRouter();
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    let refreshed=false;
    const check=()=>{
      clearTimeout(timer);
      const remaining=Date.parse(deadline)-Date.now();
      if(remaining<=0){if(!refreshed){refreshed=true;router.refresh();}return;}
      timer=setTimeout(check,Math.min(remaining+50,60000));
    };
    check(); document.addEventListener('visibilitychange',check);
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',check);};
  },[deadline,router]);
  return null;
}
