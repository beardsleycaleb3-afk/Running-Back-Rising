// ============================================================================
// TRIE.JS — Layer 4b
// WHAT:  A generic Trie (prefix tree) used to index gear item IDs and asset
//        manifest keys for fast prefix lookup — e.g. typing/searching
//        "cleat" in a debug/dev tool instantly finds all cleat tiers without
//        scanning every gear entry linearly.
// HOW:   Standard trie node = { children: Map, isEnd: bool, value: any }.
//        insert(key, value), find(key) exact lookup, findByPrefix(prefix)
//        returns all matching values.
// WHEN:  Built once at boot from GEAR_CATALOG (see gear.js) and
//        ASSET_MANIFEST. Queried by dev tools / search-as-you-type UI later.
// WHY:   As gear scales into dozens of items x4 tiers x multiple slots, a
//        flat object scan is fine performance-wise, but a trie gives O(prefix
//        length) lookup and makes future features (gear search, "did you
//        mean" typo correction on asset filenames) trivial to add.
// WHERE: js/trie.js — depends on contract.js only.
// WHO:   Assistant-A owns this (pure data structure, should rarely change).
// ============================================================================

defineModule('trie.js', {
  what: 'Generic prefix-tree for fast gear-ID / asset-key lookup and prefix search',
  how: 'Map-based trie nodes, insert/find/findByPrefix',
  when: 'Built once at boot from GEAR_CATALOG + ASSET_MANIFEST keys',
  why: 'O(prefix length) lookup, groundwork for gear search / typo-correction tools',
  where: 'js/trie.js — no dependencies besides contract.js',
  who: 'Assistant-A (pure data structure)',
  exports: ['createTrie'],
  dependsOn: ['contract.js']
});

function createTrieNode() {
  return { children: new Map(), isEnd: false, value: null };
}

function createTrie() {
  const root = createTrieNode();

  return {
    /**
     * @param {string} key
     * @param {*} value
     */
    insert(key, value) {
      let node = root;
      for (const ch of key.toLowerCase()) {
        if (!node.children.has(ch)) node.children.set(ch, createTrieNode());
        node = node.children.get(ch);
      }
      node.isEnd = true;
      node.value = value;
    },

    /**
     * @param {string} key
     * @returns {*|null} the exact value, or null if not found
     */
    find(key) {
      let node = root;
      for (const ch of key.toLowerCase()) {
        if (!node.children.has(ch)) return null;
        node = node.children.get(ch);
      }
      return node.isEnd ? node.value : null;
    },

    /**
     * @param {string} prefix
     * @returns {Array<{key:string, value:*}>} all entries starting with prefix
     */
    findByPrefix(prefix) {
      let node = root;
      for (const ch of prefix.toLowerCase()) {
        if (!node.children.has(ch)) return [];
        node = node.children.get(ch);
      }
      const results = [];
      const walk = (n, path) => {
        if (n.isEnd) results.push({ key: path, value: n.value });
        for (const [ch, child] of n.children) walk(child, path + ch);
      };
      walk(node, prefix.toLowerCase());
      return results;
    }
  };
}
