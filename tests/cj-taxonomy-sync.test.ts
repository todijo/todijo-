import test from "node:test";
import assert from "node:assert/strict";
import { buildCjTaxonomyMirror, findCjTaxonomyNode } from "../lib/suppliers/cj-taxonomy-sync";

test("CJ taxonomy mirror preserves stable ids and all three hierarchy levels",()=>{
  const nodes=buildCjTaxonomyMirror([
    {categoryId:"F1",first:"Pet Supplies",second:"",third:""},
    {categoryId:"S1",first:"Pet Supplies",second:"Dog Supplies",third:""},
    {categoryId:"T1",first:"Pet Supplies",second:"Dog Supplies",third:"Pet Collars"},
  ]);
  assert.deepEqual(nodes.map(node=>[node.categoryId,node.level,node.path]),[
    ["F1",1,"Pet Supplies"],
    ["S1",2,"Pet Supplies > Dog Supplies"],
    ["T1",3,"Pet Supplies > Dog Supplies > Pet Collars"],
  ]);
});

test("CJ taxonomy mirror resolves by provider id instead of translated labels",()=>{
  const nodes=buildCjTaxonomyMirror([{categoryId:"abc-123",first:"Consumer Electronics",second:"Audio & Video",third:"Speakers"}]);
  const node=findCjTaxonomyNode(nodes,"ABC-123");
  assert.equal(node?.categoryId,"abc-123");
  assert.equal(node?.path,"Consumer Electronics > Audio & Video > Speakers");
});

test("CJ taxonomy mirror rejects malformed rows without inventing categories",()=>{
  const nodes=buildCjTaxonomyMirror([
    {categoryId:"",first:"Pet Supplies",second:"Dog Supplies",third:"Pet Collars"},
    {categoryId:"T2",first:"",second:"Dog Supplies",third:"Pet Collars"},
  ]);
  assert.equal(nodes.length,0);
});
