var LayoutGenerator = (function(){
  function LayoutGenerator(style, stream){
    this.style = style;
    this.stream = stream;
    this._parentLayout = null;
    this._childLayout = null;
    this._cachedElements = [];
    this._terminate = false; // used to force terminate generator.
  }

  // 1. create child layout context from parent layout context.
  // 2. call _yield implemented in inherited class.
  LayoutGenerator.prototype.yield = function(parent_context){
    var context = parent_context? this._createChildContext(parent_context) : this._createStartContext();
    return this._yield(context);
  };

  LayoutGenerator.prototype._yield = function(context){
    throw "LayoutGenerator::_yield must be implemented in child class";
  };

  LayoutGenerator.prototype.setTerminate = function(status){
    this._terminate = status;
  };

  LayoutGenerator.prototype.setParentChildLayout = function(generator){
    if(this._parentLayout){
      this._parentLayout.setChildLayout(generator);
    }
  };

  LayoutGenerator.prototype.setChildLayout = function(generator){
    this._childLayout = generator;
    generator._parentLayout = this;
  };

  LayoutGenerator.prototype.hasNext = function(){
    if(this._terminate){
      return false;
    }
    if(this.hasCache()){
      return true;
    }
    if(this.hasChildLayout()){
      return true;
    }
    return this.stream? this.stream.hasNext() : false;
  };

  LayoutGenerator.prototype.hasChildLayout = function(){
    if(this._childLayout && this._childLayout.hasNext()){
      return true;
    }
    return false;
  };

  LayoutGenerator.prototype.hasCache = function(){
    return this._cachedElements.length > 0;
  };

  LayoutGenerator.prototype.yieldChildLayout = function(context){
    var next = this._childLayout.yield(context);
    return next;
  };

  LayoutGenerator.prototype.peekLastCache = function(){
    return List.last(this._cachedElements);
  };

  LayoutGenerator.prototype.pushCache = function(element){
    var cache_count = element.cacheCount || 0;
    if(cache_count > 0){
      if(cache_count >= Config.maxRollbackCount){
	console.error("[%s] too many cache count(%d), force terminate:%o", this.style.getMarkupName(), cache_count, this.style);
	this.setTerminate(true); // this error sometimes causes infinite loop, so force terminate generator.
	return;
      }
    }
    element.cacheCount = cache_count + 1;
    this._cachedElements.push(element);
  };

  LayoutGenerator.prototype.popCache = function(){
    var cache = this._cachedElements.pop();
    return cache;
  };

  LayoutGenerator.prototype.clearCache = function(){
    this._cachedElements = [];
  };

  // called when each time generator yields element of output, and added it.
  LayoutGenerator.prototype._onAddElement = function(block){
  };

  // called when each time generator yields output.
  LayoutGenerator.prototype._onCreate = function(context, output){
  };

  // called when generator yields final output.
  LayoutGenerator.prototype._onComplete = function(context, output){
  };

  LayoutGenerator.prototype._createStartContext = function(){
    return new LayoutContext(
      new BlockContext(this.style.contentExtent),
      new InlineContext(this.style.contentMeasure)
    );
  };

  LayoutGenerator.prototype._createChildContext = function(parent_context){
    return new LayoutContext(
      new BlockContext(parent_context.getBlockRestExtent() - this.style.getEdgeExtent()),
      new InlineContext(this.style.contentMeasure)
    );
  };

  LayoutGenerator.prototype._createStream = function(style){
    switch(style.getMarkupName()){
    case "ruby": return new RubyTokenStream(style.markup);
    default: return new TokenStream(style.getContent());
    } 
  };

  LayoutGenerator.prototype._createChildBlockGenerator = function(style, stream, outline_context){
  };

  LayoutGenerator.prototype._createChildInlineGenerator = function(style, stream, outline_context){
    switch(style.getMarkupName()){
    case "img":
      // if inline img, no content text is included in img tag, so we yield it by lazy generator.
      return new LazyGenerator(style, style.createImage());
    case "a":
      return new LinkGenerator(style, stream, outline_context);
    default:
      return new InlineGenerator(style, stream, outline_context);
    }
  };

  return LayoutGenerator;
})();

