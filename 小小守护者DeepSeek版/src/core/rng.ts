/** The sole PRNG transition, shared by map selection and stateful reward draws. */
export function seedRng(seed:number):number{return (seed>>>0)||1;}
export function nextRngState(value:number):number{let x=value;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;}
