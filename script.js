const display = document.querySelector('#display');
const buttons = document.querySelector('.calculator-buttons');

let currentValue = '0';
let storedValue = null;
let currentOperator = null;
let shouldResetDisplay = false;

function updateDisplay() {
  display.textContent = currentValue;
}

function inputNumber(number) {
  if (shouldResetDisplay || currentValue === '0') {
    currentValue = number;
    shouldResetDisplay = false;
    return;
  }

  currentValue += number;
}

function clearCalculator() {
  currentValue = '0';
  storedValue = null;
  currentOperator = null;
  shouldResetDisplay = false;
}

function backspace() {
  if (shouldResetDisplay) {
    currentValue = '0';
    shouldResetDisplay = false;
    return;
  }

  currentValue = currentValue.length > 1 ? currentValue.slice(0, -1) : '0';
}

function calculate(firstNumber, operator, secondNumber) {
  switch (operator) {
    case '+':
      return firstNumber + secondNumber;
    case '-':
      return firstNumber - secondNumber;
    case '*':
      return firstNumber * secondNumber;
    case '/':
      if (secondNumber === 0) {
        return 'Error';
      }
      return firstNumber / secondNumber;
    default:
      return secondNumber;
  }
}

function formatResult(result) {
  if (result === 'Error') {
    return result;
  }

  if (!Number.isFinite(result)) {
    return 'Error';
  }

  const rounded = Math.round((result + Number.EPSILON) * 100000000) / 100000000;
  return String(rounded);
}

function chooseOperator(operator) {
  if (currentValue === 'Error') {
    clearCalculator();
  }

  const inputValue = Number(currentValue);

  if (storedValue === null) {
    storedValue = inputValue;
  } else if (currentOperator) {
    const result = calculate(storedValue, currentOperator, inputValue);
    currentValue = formatResult(result);
    storedValue = result === 'Error' ? null : Number(currentValue);
  }

  currentOperator = operator;
  shouldResetDisplay = true;
}

function runEquals() {
  if (!currentOperator || storedValue === null) {
    return;
  }

  const result = calculate(storedValue, currentOperator, Number(currentValue));
  currentValue = formatResult(result);
  storedValue = null;
  currentOperator = null;
  shouldResetDisplay = true;
}

buttons.addEventListener('click', (event) => {
  const button = event.target.closest('button');

  if (!button) {
    return;
  }

  const number = button.dataset.number;
  const operator = button.dataset.operator;
  const action = button.dataset.action;

  if (number !== undefined) {
    inputNumber(number);
  } else if (operator) {
    chooseOperator(operator);
  } else if (action === 'clear') {
    clearCalculator();
  } else if (action === 'backspace') {
    backspace();
  } else if (action === 'equals') {
    runEquals();
  }

  updateDisplay();
});

updateDisplay();
