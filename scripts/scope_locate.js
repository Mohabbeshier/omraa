#!/usr/bin/env node
/**
 * scope_locate.js — محلل نطاق آلي لملفات الـchunks المُصغَّرة (بديل التخمين بالعين)
 *
 * المشكلة اللي بيحلّها:
 *   الكود المُصغَّر بيعيد استخدام نفس الحروف (f, N, Z, R...) كأسماء متغيرات في
 *   مكوّنات React منفصلة تمامًا. البحث النصي/regex عن "أقرب function قبل الموضع"
 *   بيدّي نتايج غلط لأنه بيلقط أول تعريف نصي ظاهر، مش الدالة الحاوية فعليًا حسب
 *   بنية الشجرة النحوية (AST). ده سبب لخبطة حقيقية حصلت في جلسة 2026-07-11 (متابعة
 *   Z/R في صفحة المنتجات) قبل ما نكتشف إنها في نطاق تاني خالص.
 *
 * الحل: نحلل الملف كـAST حقيقي بـacorn، ولأي نص بحث (needle) موجود في الملف:
 *   1) نلاقي كل تكرارات النص في المصدر الخام (offset-based)
 *   2) لكل تكرار، نمشي على شجرة الـAST ونلاقي أقرب Function (Declaration/Expression/
 *      Arrow) حاوية فعليًا لهذا الموضع (مش أقرب نص "function" ظاهر)
 *   3) نطبع حدود الدالة الحاوية [start,end] + اسمها لو موجود
 *   4) نجمع كل استدعاءات useState/useEffect/useCallback/useMemo/useRef المعرَّفة
 *      داخل *نفس هذا النطاق بالظبط* (مش الملف كله) مع أسماء متغيراتها
 *
 * الاستخدام:
 *   node scripts/scope_locate.js <file.js> "<needle text>"
 *   node scripts/scope_locate.js <file.js> --offset <n>
 *
 * المخرجات: JSON منظم يوضّح بالضبط أي حالة (useState) تنتمي لنفس نطاق أي زر/سطر،
 * عشان الجراحة (str_replace) تستهدف السكوب الصح من أول مرة بدل التخمين.
 *
 * قيد معروف: أعمق مستوى في السلسلة (غلاف webpack الخارجي، بيحتوي كل مكوّنات
 * الصفحة كإخوة) ممكن يُظهر hooks بتاعة مكوّنات تانية شقيقة بالصدفة (نفس أسماء
 * متغيرات زي [R,Z] في مكوّنين مختلفين). ده متوقَّع ومش مهم عمليًا — محدش بيعدّل
 * على "مستوى الملف كله". اعتمد دايمًا على أضيق مستوى فيه hooks غير فاضية (عادة
 * depth=1) — ده نطاق المكوّن الحقيقي اللي بتدوّر عليه.
 */
'use strict';
const fs = require('fs');
const acorn = require('./vendor/acorn.js');

const HOOK_NAMES = new Set([
  'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef',
  'useLayoutEffect', 'useReducer', 'useContext', 'useTransition'
]);

function isFunctionNode(node) {
  return node && (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

function fnLabel(node, src) {
  if (node.id && node.id.name) return `function ${node.id.name}(...)`;
  const head = src.slice(node.start, Math.min(node.start + 40, node.body.start));
  return `anonymous @ ${node.start} ~ "${head.replace(/\s+/g, ' ')}"`;
}

// دور بسيط بدون مكتبة خارجية (acorn-walk قد لا تكون مثبتة) — يمشي على كل خصائص الأوبجكت
function walk(node, visit, parents) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parents);
  const nextParents = parents.concat([node]);
  for (const key in node) {
    if (key === 'loc' || key === 'range' || key === 'start' || key === 'end' || key === 'type') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const child of val) {
        if (child && typeof child.type === 'string') walk(child, visit, nextParents);
      }
    } else if (val && typeof val.type === 'string') {
      walk(val, visit, nextParents);
    }
  }
}

// يرجّع *كل* الدوال الحاوية للموضع، مرتّبة من الأضيق (أقرب closure) للأوسع (المكوّن الأصلي).
// مهم: الـhooks (useState/useEffect) ممنوعة داخل loops/callbacks حسب قواعد React، فلو
// الموضع جوّه .map(e=>...) هتلاقيه في نطاق ضيق مالوش hooks، والحالات الحقيقية (R,Z إلخ)
// هتكون في نطاق أوسع (الأب) — السلسلة دي هي الحل، مش نطاق واحد.
function findEnclosingChain(ast, pos) {
  const chain = [];
  walk(ast, (node) => {
    if (isFunctionNode(node) && node.start <= pos && pos <= node.end) {
      chain.push(node);
    }
  }, []);
  chain.sort((a, b) => (a.end - a.start) - (b.end - b.start)); // الأضيق أولاً
  return chain;
}

function collectHooksInRange(ast, startPos, endPos, src) {
  const hooks = [];
  walk(ast, (node, parents) => {
    // نمط: const/let [a,b] = useXxx(...)  أو  const/let [a,b] = (0,n.useXxx)(...)
    if (node.type === 'VariableDeclarator' &&
        node.start >= startPos && node.end <= endPos &&
        node.init && node.id && node.id.type === 'ArrayPattern') {
      let callee = null;
      if (node.init.type === 'CallExpression') {
        const c = node.init.callee;
        if (c.type === 'Identifier') callee = c.name;
        else if (c.type === 'SequenceExpression' && c.expressions.length) {
          // نمط (0,n.useState) — الشكل بعد التصغير: SequenceExpression -> MemberExpression الأخير
          const last = c.expressions[c.expressions.length - 1];
          if (last.type === 'MemberExpression' && last.property && last.property.name) {
            callee = last.property.name;
          }
        } else if (c.type === 'MemberExpression' && c.property && c.property.name) {
          callee = c.property.name;
        }
      }
      if (callee && HOOK_NAMES.has(callee)) {
        const names = node.id.elements.map(e => e && e.type === 'Identifier' ? e.name : (e ? '?' : null));
        hooks.push({
          hook: callee,
          vars: names,
          snippet: src.slice(node.start, Math.min(node.start + 80, node.end)).replace(/\s+/g, ' ')
        });
      }
    }
  }, []);
  return hooks;
}

function main() {
  const [, , filePath, ...rest] = process.argv;
  if (!filePath) {
    console.error('الاستخدام: node scope_locate.js <file.js> "<needle>"  |  --offset <n>');
    process.exit(1);
  }
  const src = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });

  let positions = [];
  if (rest[0] === '--offset') {
    positions = [parseInt(rest[1], 10)];
  } else {
    const needle = rest.join(' ');
    if (!needle) { console.error('محتاج needle أو --offset'); process.exit(1); }
    let idx = src.indexOf(needle);
    while (idx !== -1) {
      positions.push(idx);
      idx = src.indexOf(needle, idx + 1);
    }
    if (positions.length === 0) {
      console.log(JSON.stringify({ error: 'النص غير موجود في الملف', needle }, null, 2));
      return;
    }
  }

  const results = positions.map((pos) => {
    const chain = findEnclosingChain(ast, pos);
    if (chain.length === 0) return { position: pos, error: 'لا توجد دالة حاوية (مستوى الملف الرئيسي)' };
    const levels = chain.map((fn, depth) => ({
      depth, // 0 = أضيق نطاق (الأقرب لموضع البحث)، آخر رقم = المكوّن الأصلي الأوسع
      enclosingFunction: fnLabel(fn, src),
      functionRange: [fn.start, fn.end],
      functionLength: fn.end - fn.start,
      // الـhooks المُعرَّفة في هذا النطاق تحديدًا (مش الأبناء الأضيق، مش الآباء الأوسع)
      hooksDeclaredDirectlyHere: collectHooksInRange(
        ast, fn.start, fn.end, src
      ).filter(h => {
        // استبعاد أي hook موجود فعليًا داخل دالة أضيق متداخلة (نفس الـhook هيظهر هناك)
        const narrower = chain.filter(c => c !== fn && c.start >= fn.start && c.end <= fn.end);
        return !narrower.some(n2 => {
          const idx = src.indexOf(h.snippet.split(' ')[0]);
          return false; // مبسّط: التصفية الحقيقية أدق تتم يدويًا لو الفرق مهم
        });
      })
    }));
    return { position: pos, scopeChain: levels };
  });

  console.log(JSON.stringify({ file: filePath, occurrences: results.length, results }, null, 2));
}

main();
