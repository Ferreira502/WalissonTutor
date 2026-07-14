export class MemoryAllocator {
  constructor() {
    this.stackBase = 0x7ffc1000;
    this.heapBase = 0x7ffc2000;
    this.stackOffset = 0;
    this.heapOffset = 0;
  }

  getTypeSize(type) {
    switch (type) {
      case 'char':
        return 1;
      case 'int':
        return 4;
      case 'float':
        return 4;
      case 'double':
        return 8;
      case 'int*':
      case 'char*':
      case 'void*':
      case 'vector<int>':
        return 8;
      default:
        return 8;
    }
  }

  getTypeAlignment(type) {
    return Math.min(this.getTypeSize(type), 8);
  }

  align(offset, alignment) {
    const remainder = offset % alignment;
    return remainder === 0 ? offset : offset + (alignment - remainder);
  }

  format(address) {
    return `0x${address.toString(16)}`;
  }

  allocateStack(type) {
    this.stackOffset = this.align(this.stackOffset, this.getTypeAlignment(type));
    const address = this.stackBase + this.stackOffset;
    this.stackOffset += this.getTypeSize(type);
    return this.format(address);
  }

  allocateHeap(byteSize, alignment = 4) {
    this.heapOffset = this.align(this.heapOffset, alignment);
    const address = this.heapBase + this.heapOffset;
    this.heapOffset += byteSize;
    return this.format(address);
  }

  contiguousAddresses(baseAddress, count, type) {
    const start = Number.parseInt(baseAddress.replace('0x', ''), 16);
    const size = this.getTypeSize(type);
    return Array.from({ length: count }, (_, index) => this.format(start + index * size));
  }
}
