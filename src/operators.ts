// operators.ts
import { QueryOperator, OperatorQuery } from "./types";

export const evaluateOperator = (
  operator: QueryOperator,
  value: any,
  docValue: any
): boolean => {
  // Add debug logging
  // console.log(`Evaluating ${operator}:`, { value, docValue });

  switch (operator) {
    case "$eq":
      const result = docValue === value;
      // console.log(`$eq comparison result:`, result);
      return result;
    case "$gt":
      return docValue > value;
    case "$gte":
      return docValue >= value;
    case "$lt":
      return docValue < value;
    case "$lte":
      return docValue <= value;
    case "$in":
      return Array.isArray(value) && value.includes(docValue);
    case "$nin":
      return Array.isArray(value) && !value.includes(docValue);
    case "$ne":
      return docValue !== value;
    case "$exists":
      return value ? docValue !== undefined : docValue === undefined;
    case "$type":
      return typeof docValue === value;
    case "$regex":
      return new RegExp(value).test(docValue);
    case "$all":
      if (!Array.isArray(docValue) || !Array.isArray(value)) {
        return false;
      }
      return value.every((val) => docValue.includes(val));
    case "$size":
      return Array.isArray(docValue) && docValue.length === value;

    case "$elemMatch":
      if (!Array.isArray(docValue)) {
        return false;
      }
      return docValue.some((elem) => {
        if (typeof value === "object") {
          return Object.entries(value).every(([op, val]) =>
            evaluateOperator(op as QueryOperator, val, elem)
          );
        }
        return elem === value;
      });

    case "$not":
      if (typeof value === "object") {
        return !Object.entries(value).every(([op, val]) =>
          evaluateOperator(op as QueryOperator, val, docValue)
        );
      }
      return docValue !== value;

    default:
      console.log("Unknown operator:", operator);
      return false;
  }
};

export const matchesQuery = (document: any, query: OperatorQuery): boolean => {
  // console.log("\nMatching document:", document);
  // console.log("Against query:", query);

  return Object.entries(query).every(([key, condition]) => {
    // console.log("\nChecking field:", key);
    // console.log("With condition:", condition);

    // Handle logical operators
    if (key === "$or" && Array.isArray(condition)) {
      return condition.some((subQuery) => matchesQuery(document, subQuery));
    }

    if (key === "$and" && Array.isArray(condition)) {
      return condition.every((subQuery) => matchesQuery(document, subQuery));
    }

    if (key === "$not") {
      return !matchesQuery(document, condition);
    }

    const docValue = document[key];

    // Handle direct value comparison
    if (condition === null || typeof condition !== "object") {
      return docValue === condition;
    }

    // Handle operator conditions
    return Object.entries(condition).every(([op, value]) => {
      return evaluateOperator(op as QueryOperator, value, docValue);
    });
  });
};
