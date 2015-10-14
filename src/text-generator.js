var TextGenerator = (function(){
  /**
     @memberof Nehan
     @class TextGenerator
     @classdesc inline level generator, output inline level block.
     @constructor
     @extends {Nehan.LayoutGenerator}
     @param style {Nehan.StyleContext}
     @param stream {Nehan.TokenStream}
     @param child_generator {Nehan.LayoutGenerator}
  */
  function TextGenerator(style, stream){
    LayoutGenerator.call(this, style, stream);
  }
  Nehan.Class.extend(TextGenerator, LayoutGenerator);

  var __find_head_text = function(element){
    return (element instanceof Box)? __find_head_text(element.elements[0]) : element;
  };

  TextGenerator.prototype._yield = function(context){
    if(!context.hasInlineSpaceFor(1)){
      return null;
    }
    var is_head_output = this.style.contentMeasure === context.getInlineMaxMeasure();

    while(this.hasNext()){
      var element = this._getNext(context);
      if(element === null){
	break;
      }
      var measure = this._getMeasure(element);
      //console.log("[t:%s]%o(%s), m = %d (%d/%d)", this.style.markupName, element, (element.data || ""), measure, (context.inline.curMeasure + measure), context.inline.maxMeasure);
      if(measure === 0){
	break;
      }
      // skip head space for first word element if not 'white-space:pre'
      if(is_head_output && context.getInlineCurMeasure() === 0 && element instanceof Nehan.Char && element.isWhiteSpace() && !this.style.isPre()){
	var next = this.stream.peek();
	if(next && next instanceof Nehan.Word){
	  continue; // skip head space
	}
      }
      if(!context.hasInlineSpaceFor(measure)){
	//console.info("!> text overflow:%o(%s, m=%d)", element, element.data, measure);
	this.pushCache(element);
	context.setLineOver(true);
	break;
      }
      this._addElement(context, element, measure);
      //console.log("cur measure:%d", context.inline.curMeasure);
      if(!context.hasInlineSpaceFor(1)){
	context.setLineOver(true);
	break;
      }
    }
    return this._createOutput(context);
  };

  TextGenerator.prototype._createChildContext = function(context){
    return new Nehan.LayoutContext(
      context.block, // inline generator inherits block context as it is.
      new Nehan.InlineContext(context.getInlineRestMeasure())
    );
  };

  TextGenerator.prototype._createOutput = function(context){
    if(context.isInlineEmpty()){
      return null;
    }
    // hyphenate if this line is generated by overflow(not line-break).
    if(Nehan.Config.hyphenate && !context.isInlineEmpty() && !context.hasLineBreak() && context.getInlineRestMeasure() <= this.style.getFontSize()){
      this._hyphenateLine(context);
    }
    var line = this.style.createTextBlock({
      hasLineBreak:context.hasLineBreak(), // is line break included in?
      lineOver:context.isLineOver(), // is line full-filled?
      breakAfter:context.hasBreakAfter(), // is break after included in?
      hyphenated:context.isHyphenated(), // is line hyphenated?
      measure:context.getInlineCurMeasure(), // actual measure
      elements:context.getInlineElements(), // all inline-child, not only text, but recursive child box.
      charCount:context.getInlineCharCount(),
      maxExtent:context.getInlineMaxExtent(),
      maxFontSize:context.getInlineMaxFontSize(),
      dangling:context.getDangling(),
      isEmpty:context.isInlineEmpty()
    });

    // set position in parent stream.
    if(this._parent && this._parent.stream){
      line.pos = Math.max(0, this._parent.stream.getPos() - 1);
    }

    // call _onCreate callback for 'each' output
    this._onCreate(context, line);

    // call _onComplete callback for 'final' output
    if(!this.hasNext()){
      this._onComplete(context, line);
    }
    //console.log(">> texts:[%s], context = %o, stream pos:%d, stream:%o", line.toString(), context, this.stream.getPos(), this.stream);
    return line;
  };

  TextGenerator.prototype._getSiblingGenerator = function(){
    if(this.style.markupName === "rt"){
      return null;
    }
    var root_line = this._parent;
    while(root_line && root_line.style === this.style){
      root_line = root_line._parent || null;
    }
    return root_line || this._parent || null;
  };

  TextGenerator.prototype._getSiblingStream = function(){
    var sibling_gen = this._getSiblingGenerator();
    return (sibling_gen && sibling_gen.stream)? sibling_gen.stream : null;
  };

  TextGenerator.prototype._peekSiblingNextToken = function(){
    var sibling_stream = this._getSiblingStream();
    return sibling_stream? sibling_stream.peek() : null;
  };

  TextGenerator.prototype._peekSiblingNextHeadChar = function(){
    var head_c1;
    var token = this._peekSiblingNextToken();
    if(token instanceof Nehan.Text){
      head_c1 = token.getContent().substring(0,1);
      return new Nehan.Char(head_c1);
    }
    // if parent next token is not Nehan::Text,
    // it's hard to find first character, so skip it.
    return null;
  };

  // hyphenate between two different inline generator.
  TextGenerator.prototype._hyphenateSibling = function(context, generator){
    var next_token = generator.stream.peek();
    var tail = context.getInlineLastElement();
    var head = (next_token instanceof Nehan.Text)? next_token.getHeadChar() : null;
    if(Nehan.Config.danglingHyphenate && head && head.isHeadNg()){
      next_token.cutHeadChar();
      context.setDangling({
	data:head,
	style:this._getSiblingGenerator().style
      });
      return;
    } else if(tail && tail instanceof Nehan.Char && tail.isTailNg() && context.getInlineElements().length > 1){
      context.popInlineElement();
      this.stream.setPos(tail.pos);
      context.setLineBreak(true);
      context.setHyphenated(true);
      this.clearCache();
    }
  };

  TextGenerator.prototype._hyphenateLine = function(context){
    // by stream.getToken(), stream pos has been moved to next pos already, so cur pos is the next head.
    var old_head = this.peekLastCache() || this.stream.peek();
    if(old_head === null){
      var sibling_generator = this._getSiblingGenerator();
      if(sibling_generator && sibling_generator.stream){
	this._hyphenateSibling(context, sibling_generator);
      }
      return;
    }
    // hyphenate by dangling.
    var head_next = this.stream.peek();
    head_next = (head_next && old_head.pos === head_next.pos)? this.stream.peek(1) : head_next;
    var is_single_head_ng = function(head, head_next){
      return (head instanceof Nehan.Char && head.isHeadNg()) &&
	!(head_next instanceof Nehan.Char && head_next.isHeadNg());
    };
    if(Nehan.Config.danglingHyphenate && is_single_head_ng(old_head, head_next)){
      this._addElement(context, old_head, 0); // push tail as zero element
      if(head_next){
	this.stream.setPos(head_next.pos);
      } else {
	this.stream.get();
      }
      context.setLineBreak(true);
      context.setHyphenated(true);
      this.clearCache();
      return;
    }
    // hyphenate by sweep.
    var new_head = context.hyphenateSweep(old_head); // if fixed, new_head token is returned.
    if(new_head){
      //console.log("hyphenate by sweep:old_head:%o, new_head:%o", old_head, new_head);
      var hyphenated_measure = new_head.bodySize || 0;
      if(Math.abs(new_head.pos - old_head.pos) > 1){
	hyphenated_measure = Math.abs(new_head.pos - old_head.pos) * this.style.getFontSize(); // [FIXME] this is not accurate size.
      }
      context.addInlineMeasure(-1 * hyphenated_measure); // subtract sweeped measure.
      //console.log("hyphenate and new head:%o", new_head);
      this.stream.setPos(new_head.pos);
      context.setLineBreak(true);
      context.setHyphenated(true);
      this.clearCache(); // stream position changed, so disable cache.
    }
  };

  TextGenerator.prototype._getNext = function(context){
    if(this.hasCache()){
      var cache = this.popCache(context);
      return cache;
    }

    // read next token
    var token = this.stream.get();
    if(token === null){
      return null;
    }

    //console.log("text token:%o", token);

    // if white-space
    if(Nehan.Token.isWhiteSpace(token)){
      return this._getWhiteSpace(context, token);
    }

    return this._getText(context, token);
  };

  TextGenerator.prototype._breakInline = function(block_gen){
    this.setTerminate(true);
    if(this._parent === null){
      return;
    }
    if(this._parent instanceof TextGenerator){
      this._parent._breakInline(block_gen);
    } else {
      this._parent.setChildLayout(block_gen);
    }
  };

  TextGenerator.prototype._getWhiteSpace = function(context, token){
    if(this.style.isPre()){
      return this._getWhiteSpacePre(context, token);
    }
    // skip continuous white-spaces.
    this.stream.skipUntil(Nehan.Token.isWhiteSpace);

    // first new-line and tab are treated as single half space.
    if(token.isNewLine() || token.isTabSpace()){
      Nehan.Char.call(token, " "); // update by half-space
    }
    // if white-space is not new-line, use first one.
    return this._getText(context, token);
  };

  TextGenerator.prototype._getWhiteSpacePre = function(context, token){
    if(Nehan.Token.isNewLine(token)){
      context.setLineBreak(true);
      return null;
    }
    return this._getText(context, token); // read as normal text
  };

  TextGenerator.prototype._getText = function(context, token){
    if(!token.hasMetrics()){
      this._setTextMetrics(context, token);
    }
    switch(token._type){
    case "char":
    case "tcy":
    case "ruby":
      return token;
    case "word":
      return this._getWord(context, token);
    }
    console.error("Nehan::TextGenerator, undefined token:", token);
    throw "Nehan::TextGenerator, undefined token";
  };

  TextGenerator.prototype._setTextMetrics = function(context, token){
    // if charactor token, set kerning before setting metrics.
    // because some additional space is added if kerning is enabled or not.
    if(Nehan.Config.kerning){
      if(token instanceof Nehan.Char && token.isKerningChar()){
	this._setTextSpacing(context, token);
      } else if(token instanceof Nehan.Word){
	this._setTextSpacing(context, token);
      }
    }
    token.setMetrics(this.style.flow, this.style.getFont());
  };

  TextGenerator.prototype._setTextSpacing = function(context, token){
    var next_token = this.stream.peek();
    var prev_text = context.getInlineLastElement();
    var next_text = next_token && Nehan.Token.isText(next_token)? next_token : null;
    Nehan.Spacing.add(token, prev_text, next_text);
  };

  TextGenerator.prototype._getWord = function(context, token){
    var rest_measure = context.getInlineRestMeasure();
    var advance = token.getAdvance(this.style.flow, this.style.letterSpacing || 0);
    
    // if there is enough space for this word, just return.
    if(advance <= rest_measure){
      token.setDivided(false);
      return token;
    }
    // at this point, this word is larger than rest space.
    // but if this word size is less than max_measure and 'word-berak' is not 'break-all',
    // just break line and show it at the head of next line.
    if(advance <= context.getInlineMaxMeasure() && !this.style.isWordBreakAll()){
      return token; // overflow and cached
    }
    // at this point, situations are
    // 1. advance is larger than rest_measure and 'word-break' is set to 'break-all'.
    // 2. or word itself is larger than max_measure.
    // in these case, we must cut this word into some parts.
    var part = token.cutMeasure(this.style.flow, this.style.getFont(), rest_measure); // get sliced word
    if(!token.isDivided()){
      return token;
    }
    if(token.data !== "" && token.bodySize > 0){
      this.stream.prev(); // re-parse this token because rest part is still exists.
    }
    part.bodySize = Math.min(rest_measure, part.bodySize); // sometimes overflows. more accurate logic is required in the future.
    return part;
  };

  TextGenerator.prototype._getMeasure = function(element){
    return element.getAdvance(this.style.flow, this.style.letterSpacing || 0);
  };

  TextGenerator.prototype._addElement = function(context, element, measure){
    context.addInlineTextElement(element, measure);

    // call _onAddElement callback for each 'element' of output.
    this._onAddElement(context, element);
  };

  return TextGenerator;
})();

