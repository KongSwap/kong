export function convertBigIntsToStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertBigIntsToStrings(item));
  }

  if (typeof obj === "object") {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = convertBigIntsToStrings(obj[key]);
    }
    return newObj;
  }

  return obj;
}
