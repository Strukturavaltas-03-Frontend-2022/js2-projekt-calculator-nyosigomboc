// utils

// returns arr[-1]
const getLast = (arr = []) => arr[arr.length - 1];

const preprocessor = (s) => s.replaceAll('π', 'pi').replaceAll('pi', ` ${Math.PI.toString()} `)
  .replaceAll('e', ` ${Math.E.toString()} `).replaceAll('÷', '/')
  .replaceAll('×', '*');

// tokenizer

const tokenTypeEnum = {
  number: 'number',
  operator: 'operator',
  func: 'func',
  parenthesis: 'parenthesis',
  ignored: 'ignored',
};

const numberRegexp = /^[0-9]+(\.[0-9]*)?/;
const numberWithSignRegexp = /^[+-]?[0-9]+(\.[0-9]*)?/;
const operatorRegexp = /^[/*+^-]/;
const parenthesisRegexp = /^[()]/;
const functionRegexp = /^(sin|cos|tan|log|ln|min|max)/;
const ignoredRegexp = /^[, ]/;

const getStartWithRegexp = (s, re) => {
  const match = re.exec(s);
  const remainingStr = s.slice(match[0].length);
  return [match[0], remainingStr];
};

const createToken = (tokenType, value) => ({ tokenType, value });

const isOperator = (s) => operatorRegexp.test(s);
const isNumber = (s) => numberRegexp.test(s);
const isNumberWithSign = (s) => numberWithSignRegexp.test(s);
const isParenthesis = (s) => parenthesisRegexp.test(s);
const isFunction = (s) => functionRegexp.test(s);
const isIgnored = (s) => ignoredRegexp.test(s);

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

const getNumber = (s) => {
  const [numberAsStr, rest] = getStartWithRegexp(s, numberWithSignRegexp);
  return [createToken(tokenTypeEnum.number, Number.parseFloat(numberAsStr)), rest];
};

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

const tokenize = (expression) => {
  let s = expression;
  const result = [];
  let token;
  let lastLength = s.length;

  do {
    if (isIgnored(s)) {
      [, s] = getStartWithRegexp(s, ignoredRegexp);
    } else if (canBeSigned(result) ? isNumberWithSign(s) : isNumber(s)) {
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
    } else if (lastLength === s.length) {
      throw new SyntaxError('Syntax error in tokenizer:', s);
    }
    lastLength = s.length;
  } while (s.length > 0);

  return result;
};

// Shunting yard algorithm
// based on https://en.wikipedia.org/wiki/Shunting_yard_algorithm

const operators = {
  '^': { precedence: 4, leftAssociative: false },
  '*': { precedence: 3, leftAssociative: true },
  '/': { precedence: 3, leftAssociative: true },
  '+': { precedence: 2, leftAssociative: true },
  '-': { precedence: 2, leftAssociative: true },
};

const toBeDumped = (op1, op2) => {
  if (op2 === undefined || op2.tokenType !== tokenTypeEnum.operator) {
    return false;
  }
  const precedence1 = operators[op1.value].precedence;
  const precedence2 = operators[op2.value].precedence;
  const isLeftAssociative = operators[op1.value].leftAssociative;
  return (precedence2 > precedence1) || ((precedence1 === precedence2) && isLeftAssociative);
};

const isLeftParentheses = (token) => token !== undefined
  && token.tokenType === tokenTypeEnum.parenthesis && token.value === '(';

const shuntingYard = (tokens = []) => {
  const stack = [];
  const result = [];
  tokens.forEach((token) => {
    if (token.tokenType === tokenTypeEnum.number) {
      result.push(token);
    } else if (token.tokenType === tokenTypeEnum.func) {
      stack.push(token);
    } else if (token.tokenType === tokenTypeEnum.operator) {
      while (toBeDumped(token, getLast(stack))) {
        result.push(stack.pop());
      }
      stack.push(token);
    } else if (isLeftParentheses(token)) {
      stack.push(token);
    } else if (token.tokenType === tokenTypeEnum.parenthesis && token.value === ')') {
      while (!isLeftParentheses(getLast(stack))) {
        if (stack.length === 0) {
          throw new SyntaxError('Unmatched ) in the expression.');
        }
        result.push(stack.pop());
      }
      if (stack.length === 0 || !isLeftParentheses(getLast(stack))) {
        throw new SyntaxError('Unmatched ) in the expression.');
      }
      stack.pop();
      if (getLast(stack).tokenType === tokenTypeEnum.func) {
        result.push(stack.pop());
      }
    }
  });
  while (stack.length > 0 && !isLeftParentheses(getLast(stack))) {
    result.push(stack.pop());
  }
  if (isLeftParentheses(getLast(stack))) {
    throw new SyntaxError('Unmatched ( in the expression.');
  }
  return result;
};

// RPN evaluator

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

const rpnCalculate = (tokens = []) => {
  const stack = [];

  tokens.forEach((token) => {
    if (token.tokenType === tokenTypeEnum.number) {
      stack.push(token.value);
    } else {
      const operation = token.value;
      const { args, fn } = operations[operation];
      if (args === 1) {
        stack.push(fn(stack.pop()));
      } else if (args === 2) {
        const b = stack.pop();
        const a = stack.pop();
        stack.push(fn(a, b));
      }
    }
  });
  return stack;
};

const smartCalculate = (expression) => {
  try {
    const tokens = tokenize(preprocessor(expression));
    // console.log(expression);
    // console.log(tokens);
    const RPNform = shuntingYard(tokens);
    // console.log(RPNform);
    const res = rpnCalculate(RPNform);
    // console.log(res);
    if (res.length !== 1) {
      return 'Wrong expression';
    }
    return res[0];
  } catch (error) {
    return error.message;
  }
};

// dumb evaluator

const checkOperation = (left, operator, right) => (
  left.tokenType === tokenTypeEnum.number
  && right.tokenType === tokenTypeEnum.number
  && operator.tokenType === tokenTypeEnum.operator
);

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

const isCalculationDone = (tokens) => (tokens.length === 1);

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

let smart = false;

// eslint-disable-next-line no-unused-vars
const smartMode = (val) => {
  smart = val;
};

const display = document.querySelector('.output');

const calculateHandler = () => {
  if (smart) {
    display.innerHTML = smartCalculate(display.innerHTML);
  } else {
    display.innerHTML = dumbCalculate(display.innerHTML);
  }
};

const addString = (s) => {
  display.innerHTML += s;
};

const clearOutput = () => { display.innerHTML = ''; };

document.querySelector('.equals').addEventListener('click', calculateHandler);
document.querySelectorAll('.operator,.number,.func').forEach(
  (element) => element.addEventListener('click', () => addString(element.innerHTML)),
);
document.querySelector('#C').addEventListener('click', clearOutput);

// calculateHandler(); // temporary

// 123+456*789.012
// 3+4*2/(1-5)^2^3
// sin ( max ( 2, 3 ) ÷ 3 × π )
