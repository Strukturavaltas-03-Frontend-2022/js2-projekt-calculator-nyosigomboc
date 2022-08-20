// tokenizer

const tokenTypeEnum = {
  number: 'number',
  operator: 'operator',
};

const numRegexp = /[0-9.]+/;
const operatorRegexp = /[/*+-]/;

const startsWithRegexp = (char, re) => re.test(char[0]);

const getStartWithRegexp = (s, re) => {
  const match = re.exec(s);
  const remainingStr = s.slice(match[0].length);
  return [match[0], remainingStr];
};

const createToken = (type, value) => ({ tokenType: type, value });

const isOperator = (char) => startsWithRegexp(char, operatorRegexp);
const isNumber = (char) => startsWithRegexp(char, numRegexp);

const getOperator = (s) => {
  const [operator, rest] = getStartWithRegexp(s, operatorRegexp);
  return [createToken(tokenTypeEnum.operator, operator), rest];
};

const getNumber = (s) => {
  const [numberAsStr, rest] = getStartWithRegexp(s, numRegexp);
  return [createToken(tokenTypeEnum.number, Number.parseFloat(numberAsStr)), rest];
};

const tokenize = (expression) => {
  let s = expression;
  const result = [];
  let token;
  const lastLength = s.length;

  do {
    const firstChar = s[0];
    if (isOperator(firstChar)) {
      [token, s] = getOperator(s);
      result.push(token);
    } else if (isNumber(firstChar)) {
      [token, s] = getNumber(s);
      result.push(token);
    }
    if (lastLength === s.length) {
      return 'Error'; // todo: throw? raise?
    }
  } while (s.length > 0);

  return result;
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
  const tokens = tokenize(expression);
  while (!isCalculationDone(tokens)) {
    if (doOneCalculation(tokens) === false) {
      return 'Error'; // todo: throw? raise?
    }
  }
  return tokens[0].value;
};

// main.js

const display = document.querySelector('.output');

const calculateHandler = () => {
  display.innerHTML = dumbCalculate(display.innerHTML);
};

document.querySelector('.equals').addEventListener('click', calculateHandler);

// calculateHandler(); // temporary
