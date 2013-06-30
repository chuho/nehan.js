var Tcy = (function(){
  function Tcy(tcy){
    this.data = tcy;
    this._type = "tcy";
  }

  Tcy.prototype = {
    getCharCount : function(){
      return 1;
    },
    getAdvance : function(flow, letter_spacing){
      return this.bodySize + letter_spacing;
    },
    hasMetrics : function(){
      return (typeof this.bodySize != "undefined") && (typeof this.fontSize != "undefined");
    },
    hasEmpha : function(){
      return (typeof this.empha !== "undefined") && (this.empha !== "");
    },
    setMetrics : function(flow, font_size, is_bold){
      this.fontSize = font_size;
      this.bodySize = font_size;
    },
    setEmpha : function(empha){
      this.empha = empha;
    }
  };

  return Tcy;
})();

