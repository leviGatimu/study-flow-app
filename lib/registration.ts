/** Registration boundaries shared by the form action and tests. */
export function registrationInput(form: FormData) {
  const text=(key:string)=>typeof form.get(key)==='string'?String(form.get(key)):'';
  const username=text('username').trim();
  const password=text('password');
  const name=text('name').trim();
  const school=text('school').trim();
  const bio=text('bio').trim();
  const timezone=text('timezone');
  if(!/^[a-zA-Z0-9_.-]{3,32}$/.test(username))return {error:'Use 3–32 letters, numbers, dots, dashes or underscores for your username.'};
  if(password.length<8)return {error:'Use a password with at least 8 characters.'};
  if(new TextEncoder().encode(password).length>72)return {error:'Please use a shorter password; some characters take up extra space.'};
  if(password!==text('confirmPassword'))return {error:'Your passwords do not match.'};
  if(!name||name.length>60)return {error:'Enter your name using up to 60 characters.'};
  if(school.length>120)return {error:'Use up to 120 characters for your school.'};
  if(bio.length>400)return {error:'Keep your introduction to 400 characters or fewer.'};
  try{if(!timezone)throw new Error();new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{return {error:'Choose a valid timezone.'};}
  return {username,password,profile:{name,school:school||null,bio:bio||null,timezone}};
}
