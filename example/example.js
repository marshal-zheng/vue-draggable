const {VueDraggable: Draggable, Vue: VueInstance} = window;
const { createApp, ref, h, reactive } = VueInstance

const App = {
  setup() {
    onStart = () => {
      state.activeDrags = ++state.activeDrags
    }

    handleDrag = (e, ui) => {
      const {x, y} = state.deltaPosition;
      state.deltaPosition = {
        x: x + ui.deltaX,
        y: y + ui.deltaY,
      }
    };

    onStop = () => {
      state.activeDrags = --state.activeDrags
    };

    onDropAreaMouseEnter = (e) => {
      if (state.activeDrags) {
        e.target.classList.add('hovered');
      }
    }

    onDropAreaMouseLeave = (e) => {
      e.target.classList.remove('hovered');
    }

    onDrop = (e) => {
      state.activeDrags = --state.activeDrags
      if (e.target.classList.contains("drop-target")) {
        alert("Dropped!");
        e.target.classList.remove('hovered');
      }
    };

    getScrollContent = () => {
      return '\n' + Array(40).fill('x').join('\n')
    };
  
    getDefaultPositionTxt = () => {
      return 'I have a default position based on percents {x: \'-10%\', y: \'-10%\'}, so I\'m slightly offset.'
    };

    onControlledDrag = (e, position) => {
      const {x, y} = position;
      state.controlledPosition = {x, y}
    };

    adjustXPos = e => {
      e.preventDefault();
      e.stopPropagation();
      const {x, y} = state.controlledPosition;
      state.controlledPosition = {x: x - 10, y}
    };
  
    adjustYPos = e => {
      e.preventDefault();
      e.stopPropagation();
      const {controlledPosition} = state;
      const {x, y} = controlledPosition;
      state.controlledPosition = {x, y: y - 10}
    };

    onControlledDragStop = (e, position) => {
      onControlledDrag(e, position);
      onStop();
    };

    // 创建一个响应式对象
    const state = reactive({
      dragHandlers: {startFn: onStart, stopFn: onStop},
      activeDrags: 0,
      deltaPosition: {
        x: 0, y: 0
      },
      controlledPosition: {
        x: -400, y: 200
      }
    });


    return {
      state,
      handleDrag,
      getScrollContent,
      onDropAreaMouseEnter,
      onDropAreaMouseLeave,
      onDrop,
      getDefaultPositionTxt,
      onControlledDrag,
      onControlledDragStop,
      adjustXPos,
      adjustYPos
    };
  },
  components: {
    Draggable
  },
  template: `
    <div>
      <h1>Vue Draggable</h1>
      <Draggable v-bind="state.dragHandlers">
        <div class="box">I can be dragged anywhere</div>
      </Draggable>
      <Draggable axis="x" v-bind="state.dragHandlers">
        <div class="box cursor-x">I can only be dragged horizonally (x axis)</div>
      </Draggable>
      <Draggable axis="y" v-bind="state.dragHandlers">
        <div class="box cursor-y">I can only be dragged vertically (y axis)</div>
      </Draggable>
      <Draggable :startFn="() => false">
        <div class="box">I don't want to be dragged</div>
      </Draggable>
      <Draggable :dragFn="handleDrag" v-bind="state.dragHandlers">
        <div class="box">
          <div>I track my deltas</div>
          <div>x: {{state.deltaPosition.x.toFixed(0)}}, y: {{state.deltaPosition.y.toFixed(0)}}</div>
        </div>
      </Draggable>
      <Draggable handle="strong" v-bind="state.dragHandlers">
        <div class="box no-cursor">
          <strong class="cursor"><div>Drag here</div></strong>
          <div>You must click my handle to drag me</div>
        </div>
      </Draggable>
      <Draggable handle="strong">
        <div class="box no-cursor" :style="{display: 'flex', flexDirection: 'column'}">
          <strong class="cursor"><div>Drag here</div></strong>
          <div :style="{overflow: 'scroll'}">
            <div :style="{background: 'yellow', whiteSpace: 'pre-wrap'}">
              I have long scrollable content with a handle
              {{getScrollContent()}}
            </div>
          </div>
        </div>
      </Draggable>
      <Draggable cancel="strong" v-bind="state.dragHandlers">
        <div class="box">
          <strong class="no-cursor">Can't drag here</strong>
          <div>Dragging here works</div>
        </div>
      </Draggable>
      <Draggable :grid="[25, 25]" v-bind="state.dragHandlers">
        <div class="box">I snap to a 25 x 25 grid</div>
      </Draggable>
      <Draggable :grid="[50, 50]" v-bind="state.dragHandlers">
        <div class="box">I snap to a 50 x 50 grid</div>
      </Draggable>
      <Draggable :bounds="{top: -100, left: -100, right: 100, bottom: 100}" v-bind="dragHandlers">
        <div class="box">I can only be moved 100px in any direction.</div>
      </Draggable>
      <Draggable v-bind="state.dragHandlers">
        <div class="box drop-target" @mouseenter="onDropAreaMouseEnter" @mouseleave="onDropAreaMouseLeave">I can detect drops from the next box.</div>
      </Draggable>
      <Draggable v-bind="state.dragHandlers" :stopFn="onDrop">
        <div :class="{'box': true, 'no-pointer-events': state.activeDrags}">I can be dropped onto another box.</div>
      </Draggable>
      <div class="box" :style="{height: '500px', width: '500px', position: 'relative', overflow: 'auto', padding: '0'}">
        <div :style="{height: '1000px', width: '1000px', padding: '10px'}">
          <Draggable bounds="parent" v-bind="state.dragHandlers">
            <div class="box">
              I can only be moved within my offsetParent.<br /><br />
              Both parent padding and child margin work properly.
            </div>
          </Draggable>
          <Draggable bounds="parent" v-bind="state.dragHandlers">
            <div class="box">
              I also can only be moved within my offsetParent.<br /><br />
              Both parent padding and child margin work properly.
            </div>
          </Draggable>
        </div>
      </div>
      <Draggable bounds="body" v-bind="state.dragHandlers">
        <div class="box">
          I can only be moved within the confines of the body element.
        </div>
      </Draggable>
      <Draggable v-bind="state.dragHandlers">
        <div class="box" :style="{position: 'absolute', bottom: '100px', right: '100px'}">
          I already have an absolute position.
        </div>
      </Draggable>
      <Draggable :defaultPosition="{x: 25, y: 25}" v-bind="state.dragHandlers">
        <div class="box">
          {"I have a default position of {x: 25, y: 25}, so I'm slightly offset."}
        </div>
      </Draggable>
      <Draggable :positionOffset="{x: '-10%', y: '-10%'}" v-bind="state.dragHandlers">
        <div class="box">
          {{getDefaultPositionTxt()}}
        </div>
      </Draggable>
      <Draggable :position="state.controlledPosition" v-bind="state.dragHandlers" :dragFn="onControlledDrag">
        <div class="box">
          My position can be changed programmatically. <br />
          I have a drag handler to sync state.
          <div>
            <a href="#" @click={adjustXPos}>Adjust x ({{state.controlledPosition.x}})</a>
          </div>
          <div>
            <a href="#" @click={adjustYPos}>Adjust y ({{state.controlledPosition.y}})</a>
          </div>
        </div>
      </Draggable>
      <Draggable :position="state.controlledPosition" v-bind="state.dragHandlers" :stopFn="onControlledDragStop">
        <div class="box">
          My position can be changed programmatically. <br />
          I have a dragStop handler to sync state.
          <div>
            <a href="#" @click="adjustXPos">Adjust x ({{state.controlledPosition.x}})</a>
          </div>
          <div>
            <a href="#" @click="adjustYPos">Adjust y ({{state.controlledPosition.y}})</a>
          </div>
        </div>
      </Draggable>
      
    </div>
  `
};

createApp(App).mount('#container')
  // createApp({
  //   render() {
  //     const props = { style: { color: "red" } };
  //     return h('div', {}, [
  //       h('h1', {}, 'Vue Draggable'),
  //       h(Draggable, {}, [
  //         h('div', { class: 'box' }, 'I can be dragged anywhere'),
  //       ]),
  //       h(Draggable, {}, [
  //         h('div', { class: 'box' }, 'I can be dragged anywhere'),
  //       ])
  //     ])
  //   },
  // }).mount('#container')

