// utils

// returns arr[-1]
const getLast = (arr = []) => arr[arr.length - 1];

// replaces strings in the expression with more convenient strings
const preprocessor = (s) => s.replaceAll('π', 'pi').replaceAll('pi', ` ${Math.PI.toString()} `)
  .replaceAll('e', ` ${Math.E.toString()} `).replaceAll('÷', '/')
  .replaceAll('×', '*');

// tokenizer
/*
This part of the code parses the expression and creates lexical tokens.
*/

// there are lots of different token types
const tokenTypeEnum = {
  number: 'number',
  operator: 'operator',
  func: 'func',
  parenthesis: 'parenthesis',
};

// regular expressions to recognize and to return the next token of the recognized type
const numberRegexp = /^[0-9]+(\.[0-9]*)?/;
const numberWithSignRegexp = /^[+-]?[0-9]+(\.[0-9]*)?/;
const operatorRegexp = /^[/*+^-]/;
const parenthesisRegexp = /^[()]/;
const functionRegexp = /^(sin|cos|tan|log|ln|min|max)/;
const ignoredRegexp = /^[, ]/; // these are ignored, but they're important to separate numbers

// called only when it matches, returns the match and the rest of the string as an array
const getStartWithRegexp = (s, re) => {
  const match = re.exec(s);
  const remainingStr = s.slice(match[0].length);
  return [match[0], remainingStr];
};

// token "constructor"/factory
const createToken = (tokenType, value) => ({ tokenType, value });

// just to make the code more readable (despite ESlint's best efforts ;) )
const isOperator = (s) => operatorRegexp.test(s);
const isNumber = (s) => numberRegexp.test(s);
const isNumberWithSign = (s) => numberWithSignRegexp.test(s);
const isParenthesis = (s) => parenthesisRegexp.test(s);
const isFunction = (s) => functionRegexp.test(s);
const isIgnored = (s) => ignoredRegexp.test(s);

// again, readability
const getOperator = (s) => {
  const [operator, rest] = getStartWithRegexp(s, operatorRegexp);
  return [createToken(tokenTypeEnum.operator, operator), rest];
};

const getParenthesis = (s) => {
  const [parenthesis, rest] = getStartWithRegexp(s, parenthesisRegexp);
  return [createToken(tokenTypeEnum.parenthesis, parenthesis), rest];
};

const getFunction = (s) => {
  const [functionName, rest] = getStartWithRegexp(s, functionRegexp);
  return [createToken(tokenTypeEnum.func, functionName), rest];
};

// this is slightly different, numbers are stored as (floating point) numbers, not as strings
const getNumber = (s) => {
  const [numberAsStr, rest] = getStartWithRegexp(s, numberWithSignRegexp);
  return [createToken(tokenTypeEnum.number, Number.parseFloat(numberAsStr)), rest];
};

/*
+ and - are binary, infix operators, but they can be unary - prefix - operators as well
(a.k.a signs)

The parser needs to know if it's a sign or a binary operator.
If it's a sign, it gets parsed along the number.

+ and - at the beginning of the expression, after anorher operator, or after a '(' can be a sign.
*/
// returns if a number can be signed or not (it's an addition or subtraction)
const canBeSigned = (tokens = []) => {
  if (tokens.length === 0) {
    return true;
  }
  const lastToken = getLast(tokens);
  if ((lastToken.tokenType === tokenTypeEnum.operator)
    || (lastToken.tokenType === tokenTypeEnum.parenthesis && lastToken.value === '(')) {
    return true;
  }
  return false;
};

// the tokanizer
const tokenize = (expression) => {
  let s = expression; // holds the rest of the string, starts with the entire expression
  const result = []; // array of tokens to be returned
  let token; // the token to be processed
  let lastLength = s.length; // the last length of the remaining string,
  // if it stayed the same, there's an error (causes an infinite loop)

  do {
    if (isIgnored(s)) { // discard the spaces and separators
      [, s] = getStartWithRegexp(s, ignoredRegexp);
    } else if (canBeSigned(result) ? isNumberWithSign(s) : isNumber(s)) {
      // if it's a number, read it
      [token, s] = getNumber(s);
      result.push(token);
    } else if (isParenthesis(s)) {
      [token, s] = getParenthesis(s);
      result.push(token);
    } else if (isOperator(s)) {
      [token, s] = getOperator(s);
      result.push(token);
    } else if (isFunction(s)) {
      [token, s] = getFunction(s);
      result.push(token);
    } else if (lastLength === s.length) { // error
      throw new SyntaxError('Syntax error in tokenizer:', s);
    }
    lastLength = s.length;
  } while (s.length > 0);

  return result;
};

// Shunting yard algorithm
// based on https://en.wikipedia.org/wiki/Shunting_yard_algorithm

// these are the operators and their properties
const operators = {
  '^': { precedence: 4, leftAssociative: false },
  '*': { precedence: 3, leftAssociative: true },
  '/': { precedence: 3, leftAssociative: true },
  '+': { precedence: 2, leftAssociative: true },
  '-': { precedence: 2, leftAssociative: true },
};

// inner loop condition for the "operator read" case
// a bit complex, extracting this make the algorythm more readable
const toBeDumped = (op1, op2) => {
  if (op2 === undefined || op2.tokenType !== tokenTypeEnum.operator) {
    return false;
  }
  const precedence1 = operators[op1.value].precedence;
  const precedence2 = operators[op2.value].precedence;
  const isLeftAssociative = operators[op1.value].leftAssociative;
  return (precedence2 > precedence1) || ((precedence1 === precedence2) && isLeftAssociative);
};

// determines if the given token is a (
// it's needed a lot of places
const isLeftParentheses = (token) => token !== undefined
  && token.tokenType === tokenTypeEnum.parenthesis && token.value === '(';

// Shunting Yard Algo
// rearranges tokens into a Reverse Polish Notation (RPN) order
const shuntingYard = (tokens = []) => {
  const stack = []; // uses an internal "stack"
  // since Array has a pop and a push method, it's ideal for a stack
  const result = []; // tokens collected in the correct order

  tokens.forEach((token) => { // loop through the tokens and determine their types
    if (token.tokenType === tokenTypeEnum.number) { // numbers are added to the output
      result.push(token);
    } else if (token.tokenType === tokenTypeEnum.func) { // functions are simple: no precedence
      stack.push(token);
    } else if (token.tokenType === tokenTypeEnum.operator) { // operators are pushed to the stack
      // AFTER everything with a higher precedence got dumped
      while (toBeDumped(token, getLast(stack))) {
        result.push(stack.pop());
      }
      stack.push(token);
    } else if (isLeftParentheses(token)) { // ( pushed to the stack
      stack.push(token);
    } else if (token.tokenType === tokenTypeEnum.parenthesis && token.value === ')') { // ) are tricky
      while (!isLeftParentheses(getLast(stack))) {
        // the algo dumps everything from the stack to the output until it finds a matching (
        // ( and ) can be mismatched
        if (stack.length === 0) {
          throw new SyntaxError('Unmatched ) in the expression.');
        }
        result.push(stack.pop());
      }
      if (stack.length === 0 || !isLeftParentheses(getLast(stack))) {
        throw new SyntaxError('Unmatched ) in the expression.');
      }
      stack.pop();
      if (getLast(stack).tokenType === tokenTypeEnum.func) { // was this the () of a function?
        result.push(stack.pop()); // dump that as well
      }
    }
  });
  while (stack.length > 0 && !isLeftParentheses(getLast(stack))) { // dump everything else
    result.push(stack.pop());
  }
  if (isLeftParentheses(getLast(stack))) { // '(' without a closing ')'
    throw new SyntaxError('Unmatched ( in the expression.');
  }
  return result; // return the RPN
};

// RPN evaluator
/*
After the Shunting Yard did its magic, an RPN evaluator if fairly simple
*/

// at this time there isn't much difference between a function and an operator
// everything gets collected here, with the number of arguments
// unfortunately this must be a fixed value (no 'max' of any number of arguments)
// just list everything here, and tell the calculator how to calculate the operation
const operations = {
  '+': { args: 2, fn: (a, b) => a + b },
  '-': { args: 2, fn: (a, b) => a - b },
  '*': { args: 2, fn: (a, b) => a * b },
  '/': { args: 2, fn: (a, b) => a / b },
  '^': { args: 2, fn: (a, b) => a ** b },
  sin: { args: 1, fn: (x) => Math.sin(x) },
  cos: { args: 1, fn: (x) => Math.cos(x) },
  tan: { args: 1, fn: (x) => Math.tan(x) },
  log: { args: 1, fn: (x) => Math.log10(x) },
  ln: { args: 1, fn: (x) => Math.log(x) },
  min: { args: 2, fn: (a, b) => (a < b ? a : b) },
  max: { args: 2, fn: (a, b) => (a > b ? a : b) },
};

// simple RPN calculator/evaluator, gets tokens, and computes everything
// returns the stack afterwards (if everything went well, this should contain a single number)
const rpnCalculate = (tokens = []) => {
  const stack = []; // same kind of stack, but now only for numbers

  tokens.forEach((token) => {
    if (token.tokenType === tokenTypeEnum.number) { // numbers are pushed to the stack
      stack.push(token.value);
    } else { // not a number :) - must be an operator or a function - doesn't matter
      const operation = token.value; // get the operation
      const { args, fn } = operations[operation]; // see what to do
      if (args === 1) { // for functions with 1 argument
        // pop the top of the stack, run the function, and put the result back
        stack.push(fn(stack.pop()));
      } else if (args === 2) { // for 2 argument functions, let's get the 2 parameters first
        const b = stack.pop(); // the top is the 2nd parameter
        const a = stack.pop(); // under that is the 1st one
        stack.push(fn(a, b)); // run, push the same way
      } // no >=3 argument functions yet, but it would be easy to add
    }
  });
  return stack; // return the result
};

// evaluates the expression using the previous functions
const smartCalculate = (expression) => {
  try {
    // first run the preprocessor and the tokenizer
    const tokens = tokenize(preprocessor(expression));
    const RPNform = shuntingYard(tokens); // then convert tokens into RPN
    const res = rpnCalculate(RPNform); // evaluate RPN
    if (res.length !== 1) { // there are more numbers on the stack, something is wrong
      throw new SyntaxError('Wrong expression');
    }
    return res[0]; // this is the result
  } catch (error) {
    return error.message;
  }
};

// dumb evaluator
/*
This is the dumb calculator without precedence.
Uses the same tokenizer, but executes the first expression until everything is done.
*/

// an operation should have 2 arguments with a binary operator in the middle
const checkOperation = (left, operator, right) => (
  left.tokenType === tokenTypeEnum.number
  && right.tokenType === tokenTypeEnum.number
  && operator.tokenType === tokenTypeEnum.operator
);

// calculate the operation and return with the value
const calculateOperation = (left, operator, right) => {
  if (!checkOperation(left, operator, right)) {
    return null;
  }
  const a = left.value;
  const b = right.value;
  switch (operator.value) {
    case '+': return a + b;
    case '-': return a - b;
    case '/': return a / b;
    case '*': return a * b;
    default: return null;
  }
};

// is it done?
const isCalculationDone = (tokens) => (tokens.length === 1);

// takes the first 3 tokens - hopefully a number, an operator, and another number
// then calculates the operation and puts the result back into the front
// returns true on success and false in case of error (could throw an error instead)
const doOneCalculation = (tokens) => {
  const left = tokens.shift();
  const op = tokens.shift();
  const right = tokens.shift();

  if (right === undefined) {
    return false;
  }
  const result = calculateOperation(left, op, right);
  if (result === null) {
    return false;
  }
  tokens.unshift(createToken(tokenTypeEnum.number, result));
  return true;
};

// takes and expression, and tries to reduce it to a single number
// by calling doOneCalculation in a loop
// returns that single number, or 'ERROR' on error
const dumbCalculate = (expression) => {
  try {
    const tokens = tokenize(preprocessor(expression));
    while (!isCalculationDone(tokens)) {
      if (doOneCalculation(tokens) === false) {
        throw new SyntaxError('Syntax error in dumb calculate');
      }
    }
    return tokens[0].value;
  } catch {
    return 'ERROR';
  }
};

// main

// mode switcher
let smart = false;
// eslint-disable-next-line no-unused-vars
const smartMode = (val) => {
  smart = val;
};

// save the display's reference
const display = document.querySelector('.output');

// run the calculator needed on the expression and write the result back
const calculateHandler = () => {
  if (smart) {
    display.innerHTML = smartCalculate(display.innerHTML);
  } else {
    display.innerHTML = dumbCalculate(display.innerHTML);
  }
};

// adds a new character or string to the display on a button press
const addString = (s) => {
  display.innerHTML += s;
};

// clear (also called from the C button)
const clearOutput = () => { display.innerHTML = ''; };

// add event listeners
document.querySelector('.equals').addEventListener('click', calculateHandler);
document.querySelectorAll('.operator,.number,.func').forEach(
  (element) => element.addEventListener('click', () => addString(element.innerHTML)),
);
document.querySelector('#C').addEventListener('click', clearOutput);
