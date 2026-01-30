function resultOf(a, b) {
  if (a === b) return "draw";
  const win =
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper");
  return win ? "a" : "b";
}

module.exports = { resultOf };
