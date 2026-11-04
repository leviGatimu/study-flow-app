import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrationInput } from '../lib/registration.ts';

function form(overrides={}) {
  const result=new FormData();
  for(const [key,value] of Object.entries({username:'alex.learner',password:'fixture-password',confirmPassword:'fixture-password',name:' Alex Learner ',school:' Example College ',bio:' Computing student ',timezone:'Africa/Johannesburg',...overrides}))result.set(key,value);
  return result;
}
test('registration keeps the richer profile, trims text and permits optional details',()=>{
  assert.deepEqual(registrationInput(form()).profile,{name:'Alex Learner',school:'Example College',bio:'Computing student',timezone:'Africa/Johannesburg'});
  assert.equal(registrationInput(form({school:'',bio:''})).profile.bio,null);
});
test('registration validates usernames, confirmation, field limits and timezone at the server boundary',()=>{
  for(const overrides of [{username:'a'},{username:'<bad>'},{password:'short'},{confirmPassword:'different'},{name:' '},{name:'x'.repeat(61)},{school:'x'.repeat(121)},{bio:'x'.repeat(401)},{timezone:'Wrong/Zone'}])assert.ok(registrationInput(form(overrides)).error);
});
test('password limit counts UTF-8 bytes to prevent bcrypt silently truncating a password',()=>{
  const password='🧠'.repeat(19);
  assert.ok(registrationInput(form({password,confirmPassword:password})).error);
  const input=form(); input.set('username',new Blob(['alex']));
  assert.ok(registrationInput(input).error);
});
