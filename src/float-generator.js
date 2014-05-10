var FloatGenerator = (function(){
  // caution: constructor argument 'style' is the style of parent.
  // so if <body><float1>..</float1><float2>...</float2></body>,
  // style of this contructor is 'body.style'
  function FloatGenerator(style, stream, outline_context, floated_generators){
    BlockGenerator.call(this, style, stream, outline_context);
    this.generators = floated_generators;

    // create child generator to yield rest-space of float-elements with logical-float "start".
    // notice that this generator uses 'clone' of original style, because content size changes by position,
    // but on the other hand, original style is referenced by float-elements as their parent style.
    // so we must keep original style immutable.
    this.setChildLayout(new BlockGenerator(style.clone({"float":"start"}), stream, outline_context));
  }
  Class.extend(FloatGenerator, LayoutGenerator);

  FloatGenerator.prototype.hasNext = function(){
    if(this._hasNextFloat()){
      return true;
    }
    return LayoutGenerator.prototype.hasNext.call(this);
  };

  FloatGenerator.prototype._hasNextFloat = function(){
    return List.exists(this.generators, function(gen){
      return gen.hasNext();
    });
  };

  FloatGenerator.prototype._yield = function(context){
    var stack = this._yieldFloatStack(context);
    var rest_measure = context.getInlineRestMeasure();
    var rest_extent = context.getBlockRestExtent();
    return this._yieldFloat(context, stack, rest_measure, rest_extent);
  };

  FloatGenerator.prototype._yieldFloat = function(context, stack, rest_measure, rest_extent){
    if(rest_measure <= 0){
      return null;
    }
    var flow = this.style.flow;

    // no more floated layout, just yield rest area.
    if(stack.isEmpty()){
      return this._yieldFloatSpace(context, rest_measure, rest_extent);
    }
    /*
      <------ rest_measure ---->
      --------------------------
      |       |                |
      | group | rest           | => group_set(wrap_float)
      |       |                |
      --------------------------
    */
    var group = stack.pop(); // pop float group(notice that this stack is ordered by extent asc, so largest one is first obtained).
    var rest = this._yieldFloat(context, stack, rest_measure - group.getMeasure(flow), group.getExtent(flow)); // yield rest area of this group in inline-flow(recursive).
    var group_set = this._wrapFloat(group, rest, rest_measure); // wrap these 2 floated layout as one block.

    /*
      To understand rest_extent_space, remember that this func is called recursivelly,
      and argument 'rest_extent' is generated by 'previous' largest float group(g2).
      
      <--- rest_measure --->
      ----------------------------
      |    |                |    |
      | g1 | rest           | g2 |
      |    |                |    |
      ----------------------|    |
      |  rest_extent_space  |    |
      ----------------------------
    */
    var rest_extent_space = rest_extent - group.getExtent(flow);

    // no more space left in block-flow direction, or no more stream.
    if(rest_extent_space <= 0 || !this.stream.hasNext()){
      return group_set;
    }

    /*
      <------ rest_measure ---->
      --------------------------
      |       |                |
      | group | rest           | => group_set(wrap_float)
      |       |                |
      --------------------------
      |  rest_extent_space     | => rest_extent - group_set.extent
      --------------------------
    */
    // if there is space in block-flow direction, yield rest space and wrap tfloated-set and rest-space as one.
    var space = this._yieldFloatSpace(context, rest_measure, rest_extent_space);
    return this._wrapBlock(group_set, space);
  };
  
  FloatGenerator.prototype._sortFloatRest = function(floated, rest){
    var floated_elements = floated.getElements();
    return floated.isFloatStart()? floated_elements.concat(rest) : [rest].concat(floated_elements);
  };

  FloatGenerator.prototype._wrapBlock = function(block1, block2){
    var flow = this.style.flow;
    var measure = block1.getLayoutMeasure(flow); // block2 has same measure
    var extent = block1.getLayoutExtent(flow) + (block2? block2.getLayoutExtent(flow) : 0);
    var elements = block2? [block1, block2] : [block1];
    var break_after = List.exists(elements, function(element){
      return (element && element.breakAfter)? true : false;
    });

    // wrapping block always float to start direction
    return this.style.createChild("div", {"float":"start", measure:measure}).createBlock({
      elements:elements,
      breakAfter:break_after,
      extent:extent
    });
  };

  FloatGenerator.prototype._wrapFloat = function(floated, rest, measure){
    var flow = this.style.flow;
    var extent = floated.getExtent(flow);
    var elements = this._sortFloatRest(floated, rest);
    var break_after = List.exists(elements, function(element){
      return (element && element.breakAfter)? true : false;
    });
    return this.style.createChild("div", {"float":"start", measure:measure}).createBlock({
      elements:elements,
      breakAfter:break_after,
      extent:extent
    });
  };
  
  FloatGenerator.prototype._yieldFloatSpace = function(context, measure, extent){
    this._childLayout.style.updateContextSize(measure, extent);
    return this.yieldChildLayout();
  };
  
  FloatGenerator.prototype._yieldFloatStack = function(context){
    var start_blocks = [], end_blocks = [];
    List.iter(this.generators, function(gen){
      var block = gen.yield(context);
      if(block){
	if(gen.style.isFloatStart()){
	  start_blocks.push(block);
	} else if(gen.style.isFloatEnd()){
	  end_blocks.push(block);
	}
      }
    });
    return new FloatGroupStack(this.style.flow, start_blocks, end_blocks);
  };

  return FloatGenerator;
})();

