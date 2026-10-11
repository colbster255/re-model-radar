// Director coding task: implement parse_u32(const char*, uint32_t&) with rejection of
// invalid/negative/overflow inputs. Fix this actual compile failure first.
#include <cstdint>
#include <cassert>
bool parse_u32(const char* text, std::uint32_t& out) {
  return implementation_required(text, out); // deliberately undeclared
}
int main() {
  std::uint32_t n = 0;
  assert(parse_u32("42", n) && n == 42);
  assert(!parse_u32("-1", n)); assert(!parse_u32("junk", n));
  assert(!parse_u32("4294967296", n)); assert(!parse_u32("", n));
}
