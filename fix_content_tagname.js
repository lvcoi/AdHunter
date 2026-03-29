const fs = require('fs');
let c = fs.readFileSync('content.js', 'utf8');

c = c.replace(
  "function safeGetTagName(el) {\n  return Reflect.get(Element.prototype, 'tagName').call(el).toLowerCase();\n}",
  "function safeGetTagName(el) {\n  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'tagName');\n  return desc && desc.get ? desc.get.call(el).toLowerCase() : el.tagName.toLowerCase();\n}"
);

// We should also replace the remaining element.id
c = c.replace("element.id", "safeGetAttribute(element, 'id')");
c = c.replace("element.id", "safeGetAttribute(element, 'id')"); // If multiple
c = c.replace("element.id", "safeGetAttribute(element, 'id')");

// Also, let's fix the reviveElementFromHTML logic.
c = c.replace(
  "    while (current) {\n      if (safeGetTagName(current) === 'script') {\n        const toRemove = current;\n        current = walker.nextNode();\n        toRemove.remove();\n        continue;\n      }\n      const attrs = Element.prototype.getAttributeNames.call(current);\n      for (const attr of attrs) {\n        if (attr.toLowerCase().startsWith('on')) {\n          Element.prototype.removeAttribute.call(current, attr);\n        }\n      }\n      current = walker.nextNode();\n    }",
  "    while (current) {\n      if (safeGetTagName(current) === 'script') {\n        const toRemove = current;\n        current = walker.nextNode();\n        toRemove.remove();\n        continue;\n      }\n      const attrs = Element.prototype.getAttributeNames.call(current);\n      for (const attr of attrs) {\n        if (attr.toLowerCase().startsWith('on')) {\n          Element.prototype.removeAttribute.call(current, attr);\n        }\n      }\n      current = walker.nextNode();\n    }"
);

fs.writeFileSync('content.js', c);
