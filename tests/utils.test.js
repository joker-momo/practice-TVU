const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const utilsSource = fs.readFileSync(path.join(__dirname, "../js/utils.js"), "utf8");
const utils = vm.runInNewContext(`${utilsSource}\n({ answersMatch, isMultiChoiceQuestion, stripAnswerMarker })`);

test("answersMatch accepts the same correct answer despite option order", () => {
  assert.equal(utils.answersMatch(
    { options: ["Hà Nội", "Huế"], correctIndex: 0 },
    { options: ["Huế", "hà nội"], correctIndex: 1 }
  ), true);
});

test("answersMatch rejects different correct answers", () => {
  assert.equal(utils.answersMatch(
    { options: ["Hà Nội", "Huế"], correctIndex: 0 },
    { options: ["Hà Nội", "Huế"], correctIndex: 1 }
  ), false);
});

test("answersMatch compares fill-in-the-blank answers", () => {
  assert.equal(utils.answersMatch(
    { questionText: "Thủ đô Việt Nam là {{Hà Nội}}.", options: [] },
    { questionText: "Việt Nam có thủ đô là {{hà nội}}.", options: [] }
  ), true);
});

test("isMultiChoiceQuestion detects two or more wrapped options", () => {
  assert.equal(utils.isMultiChoiceQuestion({
    options: ["{{a}}", "b", "{{c}}", "d"]
  }), true);
});

test("isMultiChoiceQuestion rejects a single wrapped option", () => {
  assert.equal(utils.isMultiChoiceQuestion({
    options: ["{{a}}", "b", "c"]
  }), false);
});

test("stripAnswerMarker removes the wrapping braces", () => {
  assert.equal(utils.stripAnswerMarker("{{hand out questionnaires}}"), "hand out questionnaires");
  assert.equal(utils.stripAnswerMarker("use statistical software"), "use statistical software");
});

test("answersMatch compares multi-choice answers regardless of order", () => {
  assert.equal(utils.answersMatch(
    { options: ["a", "{{b}}", "{{c}}"] },
    { options: ["{{c}}", "{{b}}", "a"] }
  ), true);
});

test("answersMatch rejects different multi-choice answer sets", () => {
  assert.equal(utils.answersMatch(
    { options: ["a", "{{b}}", "{{c}}"] },
    { options: ["{{b}}", "{{d}}", "a"] }
  ), false);
});
