/**
 * Test script to verify that when modifying a search after rate limit is exceeded,
 * previous results are preserved and not cleared.
 * 
 * This simulates the key behavior from app/results/page.tsx
 */

interface CafeMatch {
  place: {
    id: string;
    displayName: string;
  };
  score: number;
}

// Simulate the state management logic
class ResultsPageSimulator {
  private results: CafeMatch[] = [];
  private isLoading: boolean = false;
  private preservedResultsRef: CafeMatch[] = [];
  private toastMessage: string = '';
  private showToast: boolean = false;

  // Simulate initial search with results
  performInitialSearch(): void {
    console.log('🔍 Performing initial search...');
    this.results = [
      { place: { id: '1', displayName: 'Cafe A' }, score: 0.9 },
      { place: { id: '2', displayName: 'Cafe B' }, score: 0.8 },
      { place: { id: '3', displayName: 'Cafe C' }, score: 0.7 },
    ];
    this.isLoading = false;
    console.log(`✅ Initial search complete. Results: ${this.results.length}`);
    this.printResults();
  }

  // Simulate modifying search (refinement) with rate limit hit
  modifySearchWithRateLimitHit(isRefinement: boolean): void {
    console.log(`\n🔄 Modifying search (isRefinement: ${isRefinement})...`);
    console.log(`   Current results before modification: ${this.results.length}`);
    
    // Step 1: Preserve results if this is a refinement (BEFORE any state changes)
    // This matches the real code: preserve before setIsLoading(true)
    if (isRefinement && this.results.length > 0) {
      this.preservedResultsRef = [...this.results];
      console.log(`💾 Preserved ${this.preservedResultsRef.length} results in ref`);
    } else if (isRefinement && this.results.length === 0 && this.preservedResultsRef.length > 0) {
      // Edge case: results were already cleared, but we have preserved results from before
      // Restore them now before proceeding
      this.results = [...this.preservedResultsRef];
      console.log(`🔄 Restored ${this.results.length} results from ref (edge case)`);
    }

    // Step 2: Set loading state (but don't clear results if refinement)
    this.isLoading = true;
    if (!isRefinement) {
      this.results = [];
      this.preservedResultsRef = [];
      console.log('🧹 Cleared results (not a refinement)');
    } else {
      console.log('✅ Kept results (is a refinement)');
    }

    // Step 3: Simulate rate limit check - BLOCKED
    console.log('⛔ Rate limit check: BLOCKED');
    const rateLimitData = {
      allowed: false,
      limit: 10,
      windowHours: 12,
      resetAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };

    // Step 4: Handle rate limit block
    if (!rateLimitData.allowed) {
      // Restore preserved results if needed
      if (isRefinement && this.preservedResultsRef.length > 0) {
        if (this.results.length === 0) {
          this.results = this.preservedResultsRef;
          console.log(`🔄 Restored ${this.results.length} results from ref`);
        }
      }

      this.toastMessage = `You've reached your search limit of ${rateLimitData.limit} searches per ${rateLimitData.windowHours} hours.`;
      this.showToast = true;
      this.isLoading = false;
      console.log('📢 Toast message set');
    }
  }

  // Verify the test
  verifyResultsPreserved(): boolean {
    const hasResults = this.results.length > 0;
    const hasToast = this.showToast;
    const notLoading = !this.isLoading;

    console.log('\n📊 Test Results:');
    console.log(`  - Results preserved: ${hasResults ? '✅' : '❌'} (${this.results.length} results)`);
    console.log(`  - Toast shown: ${hasToast ? '✅' : '❌'}`);
    console.log(`  - Not loading: ${notLoading ? '✅' : '❌'}`);

    if (hasResults) {
      console.log('\n📋 Preserved results:');
      this.results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.place.displayName} (ID: ${r.place.id})`);
      });
    }

    return hasResults && hasToast && notLoading;
  }

  private printResults(): void {
    console.log('📋 Current results:');
    this.results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.place.displayName}`);
    });
  }
}

// Run the tests
console.log('🧪 Testing Rate Limit with Search Refinement\n');

let allTestsPassed = true;

// Test Case 1: Refinement with rate limit (results should be preserved)
console.log('='.repeat(60));
console.log('TEST 1: Refinement with rate limit hit');
console.log('='.repeat(60));
const simulator1 = new ResultsPageSimulator();
simulator1.performInitialSearch();
simulator1.modifySearchWithRateLimitHit(true);
const test1Passed = simulator1.verifyResultsPreserved();
if (!test1Passed) allTestsPassed = false;

// Test Case 2: Edge case - preserve results first, then they get cleared, should restore
console.log('\n' + '='.repeat(60));
console.log('TEST 2: Edge case - preserve first, then restore if cleared');
console.log('='.repeat(60));
const simulator2 = new ResultsPageSimulator();
simulator2.performInitialSearch();
// Simulate: preserve results first (like when URL changes)
simulator2['preservedResultsRef'] = [...simulator2['results']];
console.log('💾 Preserved results in ref first');
// Then simulate results being accidentally cleared (e.g., by React re-render)
simulator2['results'] = [];
console.log('⚠️  Results accidentally cleared (simulating edge case)');
// Now modify search - should restore from preserved ref
simulator2.modifySearchWithRateLimitHit(true);
const test2Passed = simulator2.verifyResultsPreserved();
if (!test2Passed) allTestsPassed = false;

// Test Case 3: Fresh search (not refinement) - should clear results
console.log('\n' + '='.repeat(60));
console.log('TEST 3: Fresh search (not refinement) - should clear results');
console.log('='.repeat(60));
const simulator3 = new ResultsPageSimulator();
simulator3.performInitialSearch();
simulator3.modifySearchWithRateLimitHit(false); // Not a refinement
const test3Passed = simulator3['results'].length === 0; // Should be cleared
console.log('\n📊 Test Results:');
console.log(`  - Results cleared: ${test3Passed ? '✅' : '❌'} (${simulator3['results'].length} results)`);
if (!test3Passed) allTestsPassed = false;

console.log('\n' + '='.repeat(60));
if (allTestsPassed) {
  console.log('✅ ALL TESTS PASSED');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED');
  process.exit(1);
}

