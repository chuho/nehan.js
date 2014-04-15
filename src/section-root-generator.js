var SectionRootGenerator = (function(){
  function SectionRootGenerator(style, stream){
    BlockGenerator.call(this, style, stream);
    this.outlineContext = new OutlineContext(style); // create new section root
  }
  Class.extend(SectionRootGenerator, BlockGenerator);

  SectionRootGenerator.prototype._onComplete = function(){
    DocumentContext.addOutlineContext(this.outlineContext);
  };

  return SectionRootGenerator;
})();
