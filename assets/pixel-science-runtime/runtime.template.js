(function () {
  "use strict";

  const PACK_BUNDLE = __PACK_BUNDLE__;
  const ALLOWED_PRIMITIVES = new Set(["dialogue", "release-object", "slider-model", "choice-model", "threshold-response-lab", "orbit-launch", "summary"]);
  const ALLOWED_OPERATORS = new Set(["literal", "input", "add", "subtract", "multiply", "divide", "power", "sqrt", "abs", "min", "max", "lt", "lte", "gt", "gte", "equal", "if"]);
  const OPERATOR_ARITY = { add:2, subtract:2, multiply:2, divide:2, power:2, sqrt:1, abs:1, min:2, max:2, lt:2, lte:2, gt:2, gte:2, equal:2, if:3 };
  const COLORS = { action: "#C6E46A", result: "#F2B45F", danger: "#E36B68", brass: "#B87924", text: "#F0E9E1" };

  const element = (id) => document.getElementById(id);
  const dom = {
    app: element("app"), viewport: element("game-viewport"), shell: element("game-shell"), canvas: element("stage-canvas"),
    brand: element("brand"), progress: element("progress"), settings: element("settings-button"), copy: element("stage-copy"),
    count: element("stage-count"), title: element("stage-title"), prompt: element("stage-prompt"), deck: element("control-deck"),
    controls: element("control-main"), feedbackRow: element("feedback-row"), portrait: element("scientist-portrait"), result: element("result-label"), feedback: element("feedback-label"),
    hint: element("hint-button"), deeper: element("deeper-button"), next: element("continue-button"), startCard: element("start-card"),
    startTitle: element("start-title"), startDescription: element("start-description"), start: element("start-button"),
    modal: element("modal-card"), modalEyebrow: element("modal-eyebrow"), modalTitle: element("modal-title"), modalBody: element("modal-body"),
    modalClose: element("modal-close"), subtitle: element("subtitle"), journey: element("journey-steps"), fatal: element("fatal-error"), fatalMessage: element("fatal-message")
  };

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  const PackLoader = {
    validatePack(bundle) {
      const errors = [];
      if (!bundle || typeof bundle !== "object") errors.push("内容包不是对象");
      if (bundle?.manifest?.schema_version !== "2.0.0") errors.push("内容包版本必须为2.0.0");
      if (bundle?.manifest?.runtime_compatibility?.name !== "pixel-science-browser") errors.push("浏览器底座不兼容");
      if (!Array.isArray(bundle?.experience?.stages) || bundle.experience.stages.length === 0) errors.push("体验阶段不能为空");
      const cues = bundle?.visuals?.cues || {}, cueIds = new Set(Object.keys(cues));
      const hotspotSets = bundle?.visuals?.hotspot_sets || {}, manifestAssets = new Map((bundle?.manifest?.assets || []).map((asset) => [asset.asset_id, asset]));
      for (const stage of bundle?.experience?.stages || []) {
        if (!stage.stage_id || !stage.title || !stage.prompt) errors.push("阶段缺少基础字段");
        if (!ALLOWED_PRIMITIVES.has(stage?.interaction?.primitive)) errors.push(`未知互动积木：${stage?.interaction?.primitive || "空"}`);
        if (stage?.interaction?.primitive === "threshold-response-lab") {
          const config = stage.interaction.config || {};
          if (!config.model_id) errors.push(`${stage.stage_id || "未知阶段"}缺少门槛实验模型`);
          if (!Array.isArray(config.controls) || config.controls.length < 1 || config.controls.length > 3) errors.push(`${stage.stage_id || "未知阶段"}门槛实验控件数量无效`);
          if (!Array.isArray(config.output_cards) || config.output_cards.length < 1) errors.push(`${stage.stage_id || "未知阶段"}缺少门槛实验结果卡`);
          if (!config.success_rule || !Array.isArray(config.success_rule.all)) errors.push(`${stage.stage_id || "未知阶段"}缺少门槛实验成功规则`);
        }
        if (!cueIds.has(stage.visual_cue)) errors.push(`未知画面提示：${stage.visual_cue || "空"}`);
        if (!stage?.learning?.core || !stage?.learning?.deeper) errors.push(`${stage.stage_id || "未知阶段"}缺少学习分层`);
      }
      function validateHotspotList(ownerId, hotspots) {
        if (!Array.isArray(hotspots) || hotspots.length > 24) { errors.push(`${ownerId}的热点列表无效`); return; }
        const ids = new Set();
        hotspots.forEach((hotspot, index) => {
          const rawId = String(hotspot?.hotspot_id || hotspot?.id || ""), id = rawId || hotspotId(hotspot, index), rect = hotspotRect(hotspot);
          if (!hotspot || typeof hotspot !== "object" || !rawId || ids.has(id)) errors.push(`${ownerId}包含无效或重复热点：${id}`);
          ids.add(id);
          if (!String(hotspot?.label || "").trim() || !String(hotspot?.description || "").trim()) errors.push(`${ownerId}热点${id}缺少标签或说明`);
          if (!rect || rect[0] < 0 || rect[1] < 0 || rect[2] <= 0 || rect[3] <= 0 || rect[0] + rect[2] > 960 || rect[1] + rect[3] > 540) errors.push(`${ownerId}热点${id}超出舞台安全区`);
          const maskAsset = hotspotMaskAsset(hotspot);
          if (maskAsset && !manifestAssets.has(maskAsset)) errors.push(`${ownerId}热点${id}引用未知轮廓遮罩：${maskAsset}`);
          else if (maskAsset && !String(manifestAssets.get(maskAsset)?.media_type || "").startsWith("image/")) errors.push(`${ownerId}热点${id}的轮廓遮罩不是图片：${maskAsset}`);
        });
      }
      if (!hotspotSets || typeof hotspotSets !== "object" || Array.isArray(hotspotSets)) errors.push("热点集合必须是对象");
      else for (const [setId, hotspots] of Object.entries(hotspotSets)) validateHotspotList(`热点集合${setId}`, hotspots);
      for (const [cueId, cue] of Object.entries(cues)) {
        if (cue?.hotspot_set && !Object.prototype.hasOwnProperty.call(hotspotSets, cue.hotspot_set)) errors.push(`${cueId}引用未知热点集合：${cue.hotspot_set}`);
        const hotspots = cue?.hotspots ?? cue?.render?.hotspots;
        if (hotspots !== undefined) validateHotspotList(cueId, hotspots);
        const attention = cue?.attention;
        if (attention !== undefined) {
          if (!attention || typeof attention !== "object" || Array.isArray(attention)) errors.push(`${cueId}的注意力配置必须是对象`);
          else {
            const activeHotspots = Array.isArray(hotspots) ? hotspots : hotspotSets[cue?.hotspot_set] || [];
            const activeIds = new Set(activeHotspots.map((hotspot, index) => hotspotId(hotspot, index)));
            for (const key of ["primary_hotspot_id", "result_target_id"]) {
              if (attention[key] && !activeIds.has(String(attention[key]))) errors.push(`${cueId}的注意力目标不存在：${attention[key]}`);
            }
            if (attention.dim_nonessential !== undefined && (!Number.isFinite(attention.dim_nonessential) || attention.dim_nonessential < 0 || attention.dim_nonessential > .35)) errors.push(`${cueId}的非重点压暗值必须在0到0.35之间`);
            if (attention.character_cue && !["idle", "talk", "point", "think", "surprise", "celebrate"].includes(String(attention.character_cue))) errors.push(`${cueId}的注意力人物动作无效`);
          }
        }
      }
      const motion = bundle?.visuals?.motion_contract || {};
      for (const [key, maximum] of [["camera_shake_max_px", 2], ["camera_shake_max_ms", 120], ["particle_max", 40]]) {
        if (motion[key] !== undefined && (!Number.isFinite(motion[key]) || motion[key] < 0 || motion[key] > maximum)) errors.push(`动效参数${key}超出安全范围`);
      }
      return { ok: errors.length === 0, errors };
    },
    loadPack(bundle) {
      const validation = this.validatePack(bundle);
      if (!validation.ok) return { ok: false, errors: validation.errors, pack: null };
      return { ok: true, errors: [], pack: deepFreeze(JSON.parse(JSON.stringify(bundle))) };
    }
  };

  const ModelEngine = {
    evaluate(node, inputs) {
      if (!node || typeof node !== "object" || !ALLOWED_OPERATORS.has(node.op)) throw new Error("模型包含未知运算");
      if (node.op === "literal") return this.finite(node.value);
      if (node.op === "input") {
        if (!Object.prototype.hasOwnProperty.call(inputs, node.name)) throw new Error(`模型缺少输入：${node.name}`);
        return this.finite(inputs[node.name]);
      }
      if (!Array.isArray(node.args) || node.args.length !== OPERATOR_ARITY[node.op]) throw new Error(`模型运算参数数量错误：${node.op}`);
      if (node.op === "if") return this.evaluate(node.args[0], inputs) ? this.evaluate(node.args[1], inputs) : this.evaluate(node.args[2], inputs);
      const values = (node.args || []).map((child) => this.evaluate(child, inputs));
      const binary = (fn) => this.finite(fn(values[0], values[1]));
      switch (node.op) {
        case "add": return binary((a, b) => a + b);
        case "subtract": return binary((a, b) => a - b);
        case "multiply": return binary((a, b) => a * b);
        case "divide": if (values[1] === 0) throw new Error("模型不能除以零"); return binary((a, b) => a / b);
        case "power": return binary((a, b) => Math.pow(a, b));
        case "sqrt": if (values[0] < 0) throw new Error("模型不能对负数开方"); return this.finite(Math.sqrt(values[0]));
        case "abs": return Math.abs(values[0]);
        case "min": return this.finite(Math.min(...values));
        case "max": return this.finite(Math.max(...values));
        case "lt": return values[0] < values[1];
        case "lte": return values[0] <= values[1];
        case "gt": return values[0] > values[1];
        case "gte": return values[0] >= values[1];
        case "equal": return values[0] === values[1];
        default: throw new Error("模型运算未实现");
      }
    },
    finite(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error("模型结果不是有限数值");
      return number;
    },
    run(modelId, inputs) {
      const model = (PACK.models.models || []).find((item) => item.model_id === modelId);
      if (!model) throw new Error(`未知模型：${modelId}`);
      for (const [inputId, bounds] of Object.entries(model.inputs || {})) {
        if (!Object.prototype.hasOwnProperty.call(inputs, inputId)) throw new Error(`模型缺少输入：${inputId}`);
        const value = this.finite(inputs[inputId]);
        if (Number.isFinite(Number(bounds.min)) && value < Number(bounds.min)) throw new Error(`模型输入超出下限：${inputId}`);
        if (Number.isFinite(Number(bounds.max)) && value > Number(bounds.max)) throw new Error(`模型输入超出上限：${inputId}`);
      }
      const result = {};
      for (const output of model.outputs || []) result[output.output_id] = this.evaluate(output.expression, inputs);
      return result;
    }
  };

  const InteractionRegistry = {
    create(primitiveId, config) {
      if (!ALLOWED_PRIMITIVES.has(primitiveId)) throw new Error(`未知互动积木：${primitiveId}`);
      return { primitive: primitiveId, config: JSON.parse(JSON.stringify(config || {})) };
    }
  };

  function simulateOrbit(config, speed) {
    const mu = Number(config.mu), startRadius = Number(config.start_radius), bodyRadius = Number(config.body_radius);
    const escapeRadius = Number(config.escape_radius || bodyRadius * 6), timeLimit = Number(config.time_limit || 40), dt = 1 / 180;
    let position = { x: startRadius, y: 0 }, velocity = { x: 0, y: speed }, previousAngle = 0, angleSum = 0;
    let minRadius = startRadius, maxRadius = startRadius;
    const path = [];
    for (let index = 0; index <= Math.ceil(timeLimit / dt); index += 1) {
      const radius = Math.hypot(position.x, position.y);
      if (index % 12 === 0) path.push({ ...position });
      if (radius <= bodyRadius) return { outcome: "crashed", path };
      if (radius >= escapeRadius) return { outcome: "escaped", path };
      const angle = Math.atan2(position.y, position.x);
      let delta = angle - previousAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      angleSum += Math.abs(delta); previousAngle = angle;
      minRadius = Math.min(minRadius, radius); maxRadius = Math.max(maxRadius, radius);
      if (angleSum >= Math.PI * 2 && minRadius > bodyRadius * Number(config.stable_min_radius_ratio || 1.1) && maxRadius / minRadius <= Number(config.stable_radius_ratio || 1.2)) return { outcome: "stable_orbit", path };
      const factor = -mu / Math.pow(radius, 3);
      velocity.x += position.x * factor * dt; velocity.y += position.y * factor * dt;
      position.x += velocity.x * dt; position.y += velocity.y * dt;
    }
    return { outcome: "unstable", path };
  }

  const loaded = PackLoader.loadPack(PACK_BUNDLE);
  if (!loaded.ok) {
    dom.fatal.hidden = false;
    dom.fatalMessage.textContent = loaded.errors.join("；");
    window.__PIXEL_SCIENCE_STATUS__ = { ready: false, errors: loaded.errors };
    return;
  }
  const PACK = loaded.pack;
  const assetRecords = new Map((PACK.manifest.assets || []).map((asset) => [asset.asset_id, asset]));
  const images = new Map();
  const maskOutlineCache = new Map();
  const sounds = new Map();
  const systemMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hotspotLayer = document.createElement("div");
  hotspotLayer.setAttribute("role", "group");
  hotspotLayer.setAttribute("aria-label", "场景探索热点");
  Object.assign(hotspotLayer.style, { position:"absolute", inset:"0", zIndex:"8", pointerEvents:"none" });
  dom.shell.append(hotspotLayer);
  const state = {
    started: false, stageIndex: 0, complete: false, result: null, hintLevel: 0,
    reducedMotion: systemMotionQuery.matches, reducedMotionOverridden: false,
    muted: false, subtitles: true, modalKind: "", inputs: {},
    evidence: { inputs: {}, outputs: {} }, guidedFocusId: "", assetsReady: false,
    hotspotId: "", hotspotLocked: false, hotspotAnimationId: "", hotspotFocusedAt: 0, hotspotTouchId: "", hotspotTouchAt: 0, feedbackBeforeHotspot: "",
    strongFeedbackKeys: new Set(), lastValueFeedbackAt: 0, lastFailureFeedbackAt: 0,
    stageEnteredAt: 0, lastInteractionAt: 0, firstActivationSeen: false, activationWasActive: null,
    stageAnimationId: "", characterTransient: null, characterTransientToken: 0,
    characterPlayback: { signature:"", startedAt:0, finished:false }, characterDisplayKey: "",
    uiState: "active",
    motion: { shakeStartedAt:0, shakeUntil:0, shakePx:0, flashStartedAt:0, flashUntil:0, flashColor:COLORS.result, particles:[] }
  };
  let animationRequest = 0;

  function assetUrl(assetId) {
    const record = assetRecords.get(assetId);
    if (!record) throw new Error(`缺少素材登记：${assetId}`);
    return `./pack/${record.path}`;
  }

  async function loadImages() {
    const imageAssets = (PACK.manifest.assets || []).filter((asset) => String(asset.media_type).startsWith("image/"));
    await Promise.all(imageAssets.map((asset) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { images.set(asset.asset_id, image); resolve(); };
      image.onerror = () => reject(new Error(`无法加载图片：${asset.path}`));
      image.src = assetUrl(asset.asset_id);
    })));
  }

  async function loadAudio() {
    const audioAssets = (PACK.manifest.assets || []).filter((asset) => String(asset.media_type).startsWith("audio/"));
    await Promise.all(audioAssets.map((asset) => new Promise((resolve, reject) => {
      const audio = new Audio(); let settled = false;
      const timeout = window.setTimeout(() => finish(new Error(`加载声音超时：${asset.path}`)), 5000);
      function finish(error) {
        if (settled) return; settled = true; window.clearTimeout(timeout);
        audio.removeEventListener("loadeddata", ready); audio.removeEventListener("error", failed);
        if (error) reject(error); else { sounds.set(asset.asset_id, audio); resolve(); }
      }
      function ready() { finish(); }
      function failed() { finish(new Error(`无法加载声音：${asset.path}`)); }
      audio.preload = "auto"; audio.addEventListener("loadeddata", ready); audio.addEventListener("error", failed);
      audio.src = assetUrl(asset.asset_id); audio.load();
    })));
  }

  async function loadFonts() {
    const fontAssets = (PACK.manifest.assets || []).filter((asset) => String(asset.media_type).startsWith("font/"));
    await Promise.all(fontAssets.map(async (asset, index) => {
      const identity = `${asset.asset_id} ${asset.path}`.toLowerCase();
      const family = identity.includes("title") || identity.includes("display") ? "Science Display" : identity.includes("body") ? "Science Body" : `Pack Font ${index + 1}`;
      try {
        const face = new FontFace(family, `url("${assetUrl(asset.asset_id)}")`);
        await face.load(); document.fonts.add(face);
      } catch { console.warn(`字体不可用，使用网站后备字体：${asset.path}`); }
    }));
  }

  async function loadRequiredAssets() {
    await Promise.all([loadImages(), loadAudio(), loadFonts()]);
  }

  function currentStage() { return PACK.experience.stages[state.stageIndex]; }
  function currentCue() { return PACK.visuals.cues[currentStage().visual_cue]; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, Number(value))); }

  function cueHotspots(cue = currentCue()) {
    const hotspots = cue?.hotspots ?? cue?.render?.hotspots ?? PACK.visuals.hotspot_sets?.[cue?.hotspot_set];
    return Array.isArray(hotspots) ? hotspots : [];
  }

  function hotspotId(hotspot, index = 0) { return String(hotspot?.hotspot_id || hotspot?.id || `hotspot-${index + 1}`); }

  function validPolygon(value) {
    return Array.isArray(value) && value.length >= 3 && value.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  }

  function hotspotPolygon(hotspot) {
    if (validPolygon(hotspot?.hit_polygon)) return hotspot.hit_polygon.map((point) => point.map(Number));
    if (validPolygon(hotspot?.polygon)) return hotspot.polygon.map((point) => point.map(Number));
    if (validPolygon(hotspot?.mask?.polygon)) return hotspot.mask.polygon.map((point) => point.map(Number));
    return null;
  }

  function hotspotMaskAsset(hotspot) {
    return String(hotspot?.outline_mask || hotspot?.mask_asset || hotspot?.mask?.asset || "");
  }

  function hotspotRect(hotspot) {
    const mask = Array.isArray(hotspot?.mask) ? hotspot.mask : hotspot?.mask?.bounds;
    if (Array.isArray(mask) && mask.length === 4 && mask.every(Number.isFinite)) return mask.map(Number);
    const polygon = hotspotPolygon(hotspot);
    if (!polygon) return null;
    const xs = polygon.map((point) => point[0]), ys = polygon.map((point) => point[1]);
    const left = Math.min(...xs), top = Math.min(...ys);
    return [left, top, Math.max(1, Math.max(...xs) - left), Math.max(1, Math.max(...ys) - top)];
  }

  function hotspotCenter(hotspot) {
    const rect = hotspotRect(hotspot) || [480, 270, 0, 0];
    return [rect[0] + rect[2] / 2, rect[1] + rect[3] / 2];
  }

  function currentHotspot() {
    return cueHotspots().find((hotspot, index) => hotspotId(hotspot, index) === state.hotspotId) || null;
  }
  function formatTemplate(template, values) {
    return String(template || "").replace(/\{([a-z0-9_-]+)(?::(\d))?\}/gi, (_, key, digits) => {
      const value = values[key];
      return typeof value === "number" && digits !== undefined ? value.toFixed(Number(digits)) : String(value ?? "");
    });
  }
  function modelInputs(config, value) { return { ...(config.fixed_inputs || {}), ...(config.input_id ? { [config.input_id]: value } : {}) }; }
  function isExpected(config, values, selectedValue) {
    if (Object.prototype.hasOwnProperty.call(config, "target_value")) return Math.abs(Number(selectedValue) - Number(config.target_value)) <= Number(config.tolerance || 1e-6);
    const expected = config.expected || {};
    if (!expected.output_id) return false;
    return Math.abs(Number(values[expected.output_id]) - Number(expected.value)) <= Number(expected.tolerance || 1e-6);
  }

  function rememberEvidence(group, id, value) {
    if (!state.evidence[group][id]) state.evidence[group][id] = [];
    const values = state.evidence[group][id], numeric = typeof value === "boolean" ? value : Number(value);
    if (!values.some((existing) => typeof numeric === "boolean" ? existing === numeric : Math.abs(Number(existing) - numeric) <= 1e-8)) values.push(numeric);
  }

  function observeThreshold(inputs, outputs) {
    for (const [id, value] of Object.entries(inputs)) rememberEvidence("inputs", id, value);
    for (const [id, value] of Object.entries(outputs)) rememberEvidence("outputs", id, value);
  }

  function observed(values, expected, tolerance) {
    return (values || []).some((value) => typeof expected === "boolean" ? value === expected : Math.abs(Number(value) - Number(expected)) <= Number(tolerance || 1e-6));
  }

  function thresholdConditionPass(condition, outputs) {
    const kind = condition.kind, id = condition.input_id || condition.output_id;
    if (kind === "observed-input-values") return (condition.values || []).every((value) => observed(state.evidence.inputs[id], value, condition.tolerance));
    if (kind === "observed-output-values") return (condition.values || []).every((value) => observed(state.evidence.outputs[id], value, condition.tolerance));
    if (kind === "current-output-equals") return typeof condition.value === "boolean" ? outputs[id] === condition.value : Math.abs(Number(outputs[id]) - Number(condition.value)) <= Number(condition.tolerance || 1e-6);
    if (kind === "current-output-gte") return Number(outputs[id]) >= Number(condition.value);
    if (kind === "current-output-range") return Number(outputs[id]) >= Number(condition.min) && Number(outputs[id]) <= Number(condition.max);
    return false;
  }

  function thresholdSuccess(rule, outputs) {
    return Array.isArray(rule?.all) && rule.all.length > 0 && rule.all.every((condition) => thresholdConditionPass(condition, outputs));
  }

  function thresholdOutputText(card, value) {
    if (typeof value === "boolean") return value ? (card.true_label || "是") : (card.false_label || "否");
    if (Array.isArray(card.display_bands) && card.display_bands.length) {
      const numeric = Number(value);
      for (const band of card.display_bands) {
        if (Object.prototype.hasOwnProperty.call(band, "lt") && numeric < Number(band.lt)) return String(band.label || "");
        if (Object.prototype.hasOwnProperty.call(band, "lte") && numeric <= Number(band.lte)) return String(band.label || "");
        if (!Object.prototype.hasOwnProperty.call(band, "lt") && !Object.prototype.hasOwnProperty.call(band, "lte")) return String(band.label || "");
      }
    }
    if (card.presentation === "count-plain") return Number(value) <= 0 ? "没有" : Number(value) < .8 ? "少量" : Number(value) < 1.6 ? "一些" : "很多";
    if (["energy-plain", "speed-plain"].includes(card.presentation)) return Number(value) <= 0 ? "没有" : Number(value) < .45 ? "较低" : Number(value) < 1 ? "适中" : "较高";
    const digits = Number.isInteger(Number(card.digits)) ? Number(card.digits) : 2;
    return `${Number(value).toFixed(digits)}${card.unit || ""}`;
  }

  function controlDisplayText(control, value) {
    const numeric = Number(value), minimum = Number(control.min), maximum = Number(control.max);
    const ratio = maximum > minimum ? (numeric - minimum) / (maximum - minimum) : 0;
    for (const stop of control.display_stops || []) {
      if (numeric <= Number(stop.max)) return String(stop.label);
    }
    if (control.presentation === "brightness") {
      if (ratio <= .02) return "最暗";
      if (ratio >= .98) return "最亮";
      return ratio < .4 ? "偏暗" : ratio < .72 ? "明亮" : "很亮";
    }
    if (["light-color", "light-kind"].includes(control.presentation)) {
      if (ratio < .18) return "红光";
      if (ratio < .42) return "黄绿光";
      if (ratio < .68) return "蓝紫光";
      return "紫外线";
    }
    return `${numeric}${control.unit || ""}`;
  }

  function guidedRuleMatches(rule, outputs) {
    const value = outputs?.[rule.output_id];
    if (Object.prototype.hasOwnProperty.call(rule, "equals")) return value === rule.equals;
    if (Object.prototype.hasOwnProperty.call(rule, "lt")) return Number(value) < Number(rule.lt);
    if (Object.prototype.hasOwnProperty.call(rule, "lte")) return Number(value) <= Number(rule.lte);
    if (Object.prototype.hasOwnProperty.call(rule, "gt")) return Number(value) > Number(rule.gt);
    if (Object.prototype.hasOwnProperty.call(rule, "gte")) return Number(value) >= Number(rule.gte);
    return false;
  }

  function guidedFocus(config, outputs) {
    if (Number(config.focus_after_hint_level || 0) > state.hintLevel) return "";
    const rule = (config.focus_rules || []).find((candidate) => guidedRuleMatches(candidate, outputs));
    return rule?.input_id || config.focus_input_id || config.controls?.[0]?.input_id || "";
  }

  function playCue(cueId) {
    if (state.muted || !cueId) return;
    const assetId = PACK.visuals.audio_cues?.[cueId];
    if (!assetId) return;
    const audio = sounds.get(assetId);
    if (!audio) { showFatal(`声音没有完成预载入：${assetId}`); return; }
    audio.currentTime = 0;
    audio.volume = 0.42;
    audio.play().catch((error) => {
      if (!["NotAllowedError", "AbortError"].includes(error?.name)) showFatal(`无法播放声音：${assetRecords.get(assetId)?.path || assetId}`);
    });
  }

  function motionContract() {
    const contract = PACK.visuals.motion_contract;
    return contract && typeof contract === "object" ? contract : {};
  }

  function reducedMotionDisables(feature) {
    if (!state.reducedMotion) return false;
    const disabled = motionContract().reduced_motion_disables || [];
    return ["camera-shake", "nonessential-particles"].includes(feature) || disabled.includes(feature);
  }

  function motionPreset(kind) {
    const cue = currentCue(), feedback = cue?.feedback || {};
    const configured = feedback?.motion?.[kind] || feedback?.[`${kind}_motion`] || {};
    return configured && typeof configured === "object" ? configured : {};
  }

  function triggerMotion(kind, suppliedOrigin) {
    const now = performance.now(), contract = motionContract(), preset = motionPreset(kind);
    const origin = Array.isArray(preset.origin) ? preset.origin : Array.isArray(suppliedOrigin) ? suppliedOrigin : [480, 270];
    const shakeLimit = clamp(contract.camera_shake_max_px ?? 2, 0, 2);
    const durationLimit = clamp(contract.camera_shake_max_ms ?? 120, 0, 120);
    const requestedShake = preset.shake_px ?? (kind === "failure" ? shakeLimit : kind === "success" ? Math.min(1, shakeLimit) : 0);
    const requestedDuration = preset.shake_ms ?? durationLimit;
    if (!reducedMotionDisables("camera-shake") && requestedShake > 0 && requestedDuration > 0) {
      state.motion.shakeStartedAt = now;
      state.motion.shakePx = clamp(requestedShake, 0, shakeLimit);
      state.motion.shakeUntil = now + clamp(requestedDuration, 0, durationLimit);
    }

    if (preset.flash !== false && !reducedMotionDisables("screen-flash")) {
      const defaultColor = kind === "failure" ? COLORS.danger : kind === "hotspot" ? COLORS.action : COLORS.result;
      const flashDurationLimit = clamp(contract.screen_flash_max_ms ?? 100, 0, 100);
      const flashDuration = clamp(preset.flash_ms ?? flashDurationLimit, 0, flashDurationLimit);
      state.motion.flashStartedAt = now;
      state.motion.flashUntil = now + flashDuration;
      state.motion.flashColor = String(preset.flash_color || defaultColor);
    }

    const particleLimit = Math.floor(clamp(contract.particle_max ?? 40, 0, 40));
    const defaultCount = kind === "success" ? 12 : kind === "failure" ? 4 : 0;
    const particleCount = reducedMotionDisables("nonessential-particles") ? 0 : Math.floor(clamp(preset.particle_count ?? defaultCount, 0, particleLimit));
    const color = String(preset.particle_color || (kind === "failure" ? COLORS.danger : COLORS.result));
    for (let index = 0; index < particleCount; index += 1) {
      const angle = Math.PI * 2 * index / Math.max(1, particleCount) + (index % 3) * .17;
      const speed = 34 + (index % 5) * 9;
      state.motion.particles.push({ x:Number(origin[0]), y:Number(origin[1]), vx:Math.cos(angle) * speed, vy:Math.sin(angle) * speed - 18, born:now, life:360 + (index % 4) * 55, color, size:index % 3 === 0 ? 3 : 2 });
    }
    if (state.motion.particles.length > particleLimit) state.motion.particles.splice(0, state.motion.particles.length - particleLimit);
  }

  function signalValueFeedback(node) {
    const now = performance.now();
    if (now - state.lastValueFeedbackAt < 48) return;
    state.lastValueFeedbackAt = now;
    if (!state.reducedMotion && node?.animate) {
      node.animate([
        { filter:"brightness(1)", boxShadow:"0 0 0 0 rgba(198,228,106,0)" },
        { filter:"brightness(1.18)", boxShadow:"0 0 0 2px rgba(198,228,106,.34)" },
        { filter:"brightness(1)", boxShadow:"0 0 0 0 rgba(198,228,106,0)" }
      ], { duration:120, easing:"steps(2,end)" });
    }
  }

  const CHARACTER_PRIORITY = ["celebrate", "surprise", "talk", "point", "think", "idle"];

  function characterPriority(animationId, metadata) {
    const configured = metadata?.trigger_priority || PACK.visuals.character?.trigger_priority;
    const order = Array.isArray(configured) && configured.length ? configured : CHARACTER_PRIORITY;
    const index = order.indexOf(animationId);
    return index < 0 ? 3 : order.length - index + 1;
  }

  function recordInteraction() { state.lastInteractionAt = performance.now(); }

  function setUiState(nextState) {
    state.uiState = nextState;
    dom.deck.dataset.uiState = nextState;
    updateStatus();
  }

  function restoreActiveStateAfterChange() {
    if (state.uiState !== "failure") return;
    state.result = null;
    state.complete = false;
    dom.deck.classList.remove("result-arrived", "stage-complete");
    dom.result.className = "";
    dom.result.textContent = "";
    dom.feedback.textContent = currentStage().feedback.initial || "继续调整，再观察一次。";
    dom.subtitle.textContent = state.subtitles ? currentStage().learning.observation : "";
    const submit = dom.controls.querySelector(".stage-submit");
    if (submit?.dataset.defaultLabel) submit.textContent = submit.dataset.defaultLabel;
    dom.next.hidden = true;
    dom.hint.hidden = !(currentStage().hints || []).length;
    setUiState("active");
  }

  function queueCharacterAnimation(animationId, once = true) {
    const id = String(animationId || ""); if (!id) return;
    const metadata = PACK.asset_metadata?.[PACK.visuals.character?.metadata_asset];
    if (!metadata?.animations?.[id]) return;
    if (state.characterTransient && characterPriority(state.characterTransient.id, metadata) > characterPriority(id, metadata)) return;
    state.characterTransient = { id, once, token:++state.characterTransientToken };
  }

  function observeActivation(config, outputs) {
    const outputId = config?.visual_outputs?.activation_output;
    if (!outputId || !Object.prototype.hasOwnProperty.call(outputs || {}, outputId)) return;
    const active = Boolean(outputs[outputId]);
    if (state.activationWasActive === false && active && !state.firstActivationSeen) {
      state.firstActivationSeen = true;
      queueCharacterAnimation(currentCue()?.feedback?.activation_animation || "surprise", true);
      triggerMotion("activation", currentCue()?.feedback?.activation_origin);
    }
    state.activationWasActive = active;
  }

  function setHotspot(hotspot, index, locked = false) {
    const nextId = hotspotId(hotspot, index), changed = state.hotspotId !== nextId || state.hotspotLocked !== locked;
    state.hotspotId = nextId;
    state.hotspotLocked = locked;
    const attentionCue = currentCue()?.attention?.primary_hotspot_id === nextId ? currentCue()?.attention?.character_cue : "";
    state.hotspotAnimationId = String(locked ? (hotspot?.explanation_animation || hotspot?.locked_animation || "talk") : (hotspot?.hover_animation || hotspot?.character_animation || attentionCue || "point"));
    if (changed) { recordInteraction(); state.hotspotFocusedAt = performance.now(); state.characterPlayback.signature = ""; }
    dom.app.classList.toggle("hotspot-preview", Boolean(nextId) && !locked);
    dom.app.classList.toggle("hotspot-explained", Boolean(nextId) && locked);
    updateStatus();
  }

  function clearHotspot(blur = false, restoreFeedback = true) {
    const hadLockedHotspot = state.hotspotLocked;
    state.hotspotId = ""; state.hotspotLocked = false; state.hotspotAnimationId = ""; state.hotspotFocusedAt = 0;
    state.hotspotTouchId = ""; state.hotspotTouchAt = 0;
    dom.app.classList.remove("hotspot-preview", "hotspot-explained");
    hotspotLayer.querySelectorAll("button").forEach((node) => node.setAttribute("aria-pressed", "false"));
    if (blur && document.activeElement instanceof HTMLElement && document.activeElement.closest("[data-hotspot-id]")) document.activeElement.blur();
    if (restoreFeedback && hadLockedHotspot && state.feedbackBeforeHotspot) dom.feedback.textContent = state.feedbackBeforeHotspot;
    state.feedbackBeforeHotspot = "";
    updateStatus();
  }

  function activateHotspot(hotspot, index, node) {
    const nextId = hotspotId(hotspot, index);
    if (state.hotspotLocked && state.hotspotId !== nextId) clearHotspot(false, true);
    if (!state.hotspotLocked) state.feedbackBeforeHotspot = dom.feedback.textContent || "";
    setHotspot(hotspot, index, true);
    hotspotLayer.querySelectorAll("button").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === node)));
    if (String(hotspot?.description || "").trim()) dom.feedback.textContent = String(hotspot.description);
    playCue(hotspot?.sound_cue || "hotspot");
    triggerMotion("hotspot", hotspotCenter(hotspot));
  }

  function renderHotspots() {
    hotspotLayer.replaceChildren();
    const hotspots = cueHotspots();
    hotspotLayer.hidden = !state.started || hotspots.length === 0;
    if (hotspotLayer.hidden) return;
    hotspots.forEach((hotspot, index) => {
      const rect = hotspotRect(hotspot); if (!rect) return;
      const id = hotspotId(hotspot, index), node = document.createElement("button");
      node.type = "button"; node.dataset.hotspotId = id;
      node.setAttribute("aria-label", String(hotspot.label || id));
      node.setAttribute("aria-description", String(hotspot.description || hotspot.label || id));
      node.setAttribute("aria-pressed", "false");
      Object.assign(node.style, {
        position:"absolute", left:`${rect[0]}px`, top:`${rect[1]}px`, width:`${rect[2]}px`, height:`${rect[3]}px`,
        minWidth:"0", minHeight:"0", margin:"0", padding:"0", border:"0", outline:"0", borderRadius:"0",
        background:"transparent", boxShadow:"none", color:"transparent", fontSize:"0", opacity:".001",
        pointerEvents:"auto", cursor:"pointer", transform:"none"
      });
      const polygon = hotspotPolygon(hotspot);
      if (polygon) {
        const points = polygon.map((point) => `${(point[0] - rect[0]) / rect[2] * 100}% ${(point[1] - rect[1]) / rect[3] * 100}%`).join(",");
        node.style.clipPath = `polygon(${points})`;
      }
      let suppressClickUntil = 0;
      node.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch" && !state.hotspotLocked) setHotspot(hotspot, index, false); });
      node.addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch" && !state.hotspotLocked && document.activeElement !== node) clearHotspot(); });
      node.addEventListener("focus", () => { if (!state.hotspotLocked || state.hotspotId === id) setHotspot(hotspot, index, state.hotspotLocked && state.hotspotId === id); });
      node.addEventListener("blur", () => { if (!state.hotspotLocked && state.hotspotId === id) clearHotspot(); });
      node.addEventListener("pointerup", (event) => {
        if (event.pointerType !== "touch") return;
        event.preventDefault();
        const now = performance.now(), secondTap = state.hotspotTouchId === id && now - state.hotspotTouchAt <= 4000;
        state.hotspotTouchId = id; state.hotspotTouchAt = now; suppressClickUntil = now + 600;
        if (secondTap) activateHotspot(hotspot, index, node);
        else { setHotspot(hotspot, index, false); node.focus({ preventScroll:true }); }
      });
      node.addEventListener("click", (event) => {
        if (performance.now() < suppressClickUntil) { event.preventDefault(); return; }
        activateHotspot(hotspot, index, node);
      });
      node.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { event.preventDefault(); clearHotspot(true); }
      });
      hotspotLayer.append(node);
    });
  }

  function updateStatus() {
    window.__PIXEL_SCIENCE_STATUS__ = {
      runtime: "pixel-science-browser-2", ready: state.assetsReady, started: state.started,
      stage_id: currentStage()?.stage_id || "", stage_complete: state.complete,
      ui_state: state.uiState,
      primitive: currentStage()?.interaction?.primitive || "",
      experience_complete: currentStage()?.interaction?.primitive === "summary", reduced_motion: state.reducedMotion,
      hotspot_id: state.hotspotId, hotspot_explained: state.hotspotLocked,
      character_animation: window.__PIXEL_SCIENCE_CHARACTER__?.animation_id || "",
      local_protocol: location.protocol
    };
  }

  function updateScale() {
    const scale = dom.viewport.clientWidth / 960;
    dom.shell.style.transform = `scale(${scale})`;
  }

  function renderProgress() {
    dom.progress.replaceChildren();
    const current = Number(currentStage().progress_index || 1), total = Number(PACK.experience.progress_segments || 1);
    for (let index = 1; index <= total; index += 1) {
      const marker = document.createElement("span");
      marker.className = index < current ? "done" : index === current ? "current" : "future";
      dom.progress.append(marker);
    }
    dom.progress.setAttribute("aria-label", `第${current}段，共${total}段`);
  }

  function renderJourney() {
    const cue = currentCue(), steps = cue.journey_steps || [];
    dom.journey.replaceChildren();
    dom.journey.hidden = steps.length < 2;
    if (steps.length < 2) return;
    const current = Number(cue.journey_current || 1);
    steps.forEach((labelText, index) => {
      const step = document.createElement("span");
      step.className = `journey-step ${index + 1 < current ? "done" : index + 1 === current ? "current" : "future"}`;
      const number = document.createElement("span"); number.className = "journey-number"; number.textContent = String(index + 1);
      const label = document.createElement("span"); label.textContent = labelText;
      step.append(number, label); dom.journey.append(step);
    });
  }

  function button(label, className, handler) {
    const node = document.createElement("button");
    node.type = "button"; node.textContent = label; node.className = className || "";
    node.addEventListener("click", (event) => { recordInteraction(); handler(event); });
    return node;
  }

  function stageSubmitButton(label, className, handler) {
    const node = button(label, `${className || ""} stage-submit`.trim(), handler);
    node.dataset.defaultLabel = label;
    return node;
  }

  function resultSignature(value) {
    function normalize(item) {
      if (Array.isArray(item)) return item.map(normalize);
      if (!item || typeof item !== "object") return Number.isFinite(item) ? Number(item.toFixed?.(8) ?? item) : item;
      const normalized = {};
      for (const key of Object.keys(item).filter((name) => !["started_at", "success"].includes(name)).sort()) normalized[key] = normalize(item[key]);
      return normalized;
    }
    return JSON.stringify(normalize(value));
  }

  function finishStage(result, success) {
    const stage = currentStage(), outcome = success ? "success" : "failure";
    const feedbackKey = `${stage.stage_id}:${outcome}:${resultSignature(result)}`;
    const now = performance.now();
    const failureCooldown = Math.max(600, Number(PACK.visuals.motion_contract?.failure_feedback_cooldown_ms || 600));
    const cooldownReady = success || !state.lastFailureFeedbackAt || now - state.lastFailureFeedbackAt >= failureCooldown;
    const firstStrongFeedback = !state.strongFeedbackKeys.has(feedbackKey) && cooldownReady;
    if (firstStrongFeedback) {
      state.strongFeedbackKeys.add(feedbackKey);
      if (!success) state.lastFailureFeedbackAt = now;
    }
    const previousStartedAt = Number(state.result?.started_at || performance.now());
    if (success) clearHotspot(false, false);
    state.result = { ...result, success, started_at: firstStrongFeedback ? performance.now() : previousStartedAt };
    state.complete = success;
    dom.deck.classList.toggle("stage-complete", success);
    dom.result.textContent = formatTemplate(stage.interaction.config.result_format, state.result);
    dom.result.className = success ? "success" : "danger";
    dom.feedback.textContent = success ? stage.feedback.success : stage.feedback.retry;
    dom.subtitle.textContent = state.subtitles ? (success ? stage.learning.core : stage.learning.observation) : "";
    updatePortrait(success ? "celebrating" : "surprised");
    setUiState(success ? "success" : "failure");
    const submit = dom.controls.querySelector(".stage-submit");
    if (!success && submit) submit.textContent = "再试一次";
    if (firstStrongFeedback) {
      dom.deck.classList.remove("result-arrived");
      void dom.deck.offsetWidth;
      dom.deck.classList.add("result-arrived");
      queueCharacterAnimation(success ? (currentCue()?.feedback?.success_animation || "celebrate") : (currentCue()?.feedback?.failure_animation || "surprise"), true);
      triggerMotion(outcome, currentCue()?.feedback?.[`${outcome}_origin`]);
      playCue(success ? (stage.feedback.success_sound || "success") : (stage.feedback.failure_sound || "failure"));
    }
    dom.next.disabled = !success;
    dom.next.hidden = !success || Boolean(stage.interaction.config?.auto_advance);
    dom.hint.hidden = success || !(stage.hints || []).length;
    dom.deeper.hidden = true;
    updateStatus();
  }

  function renderThresholdResponseLab(stage, config) {
    const lab = document.createElement("div"); lab.className = "threshold-lab";
    const controls = document.createElement("div"); controls.className = "threshold-controls";
    const results = document.createElement("div"); results.className = "threshold-results"; results.setAttribute("aria-live", "polite");
    const outputNodes = new Map(), controlNodes = [];
    state.inputs = { ...(config.fixed_inputs || {}) };

    for (const card of config.output_cards || []) {
      const node = document.createElement("div"); node.className = "threshold-output";
      const label = document.createElement("span"); label.textContent = card.label || card.output_id;
      const value = document.createElement("strong"); value.textContent = "—";
      node.append(label, value); results.append(node); outputNodes.set(card.output_id, { card, value });
    }

    function update(playSound) {
      try {
        const outputs = ModelEngine.run(config.model_id, state.inputs);
        observeActivation(config, outputs);
        observeThreshold(state.inputs, outputs);
        for (const [outputId, record] of outputNodes) record.value.textContent = thresholdOutputText(record.card, outputs[outputId]);
        state.result = { kind: "threshold-preview", inputs: { ...state.inputs }, ...state.inputs, ...outputs, success: null, started_at: performance.now() };
        dom.result.textContent = formatTemplate(config.preview_format || config.result_format, state.result);
        if (playSound) {
          results.classList.remove("value-updated");
          void results.offsetWidth;
          results.classList.add("value-updated");
          signalValueFeedback(results);
        }
        if (playSound) playCue("adjust");
        return outputs;
      } catch (error) {
        showFatal(error.message); return null;
      }
    }

    for (const [index, control] of (config.controls || []).entries()) {
      if (control.type === "range") {
        const field = document.createElement("div"); field.className = "threshold-control";
        const label = document.createElement("label"); const inputId = `threshold-range-${index}`; label.htmlFor = inputId;
        const current = document.createElement("strong"); const unit = control.unit || "";
        const initial = Number(control.initial); state.inputs[control.input_id] = initial;
        label.append(`${control.label || control.input_id}：`, current);
        const input = document.createElement("input"); input.id = inputId; input.type = "range"; input.className = "threshold-range"; input.dataset.inputId = control.input_id;
        input.min = control.min; input.max = control.max; input.step = control.step; input.value = initial;
        const minus = button("−", "threshold-adjust", () => setValue(Number(input.value) - Number(input.step)));
        const plus = button("+", "threshold-adjust", () => setValue(Number(input.value) + Number(input.step)));
        minus.setAttribute("aria-label", `${control.label || control.input_id}减少`); plus.setAttribute("aria-label", `${control.label || control.input_id}增加`);
        function setValue(next) {
          recordInteraction();
          restoreActiveStateAfterChange();
          const value = Math.max(Number(input.min), Math.min(Number(input.max), next)); input.value = String(value); state.inputs[control.input_id] = value; current.textContent = controlDisplayText(control, value); update(true);
        }
        input.addEventListener("input", () => setValue(Number(input.value)));
        current.textContent = controlDisplayText(control, initial); field.append(label, minus, input, plus); controls.append(field); controlNodes.push(input, minus, plus);
      }
      if (control.type === "choice") {
        const wrapper = document.createElement("div"); wrapper.className = "threshold-choice-group";
        const label = document.createElement("span"); label.className = "threshold-choice-label"; label.textContent = `${control.label || control.input_id}：`;
        wrapper.append(label);
        const options = control.options || [], initial = Number(control.initial ?? options[0]?.value); state.inputs[control.input_id] = initial;
        const buttons = options.map((option) => {
          const node = button(option.label, "threshold-choice", () => {
            restoreActiveStateAfterChange();
            state.inputs[control.input_id] = Number(option.value);
            buttons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === node)));
            update(true);
          });
          node.dataset.inputId = control.input_id; node.dataset.value = String(option.value); node.setAttribute("aria-pressed", String(Number(option.value) === initial));
          wrapper.append(node); controlNodes.push(node); return node;
        });
        controls.append(wrapper);
      }
    }

    const check = stageSubmitButton(config.button || "检查观察记录", "primary-button threshold-check", () => {
      const outputs = update(false); if (!outputs) return;
      const success = thresholdSuccess(config.success_rule, outputs);
      finishStage({ kind: "threshold-response", inputs: { ...state.inputs }, ...state.inputs, ...outputs }, success);
      if (success) controlNodes.concat(check).forEach((node) => { node.disabled = true; });
    });
    results.append(check); lab.append(controls, results); dom.controls.append(lab); update(false);
  }

  function renderGuidedThresholdLab(stage, config) {
    const cue = currentCue(), render = cue.render || {};
    const direct = Boolean(config.direct_manipulation);
    const lab = document.createElement("div"); lab.className = "guided-lab";
    const controlNodes = [], controlWrappers = new Map(); let check = null, completionQueued = false;
    state.inputs = { ...(config.fixed_inputs || {}) };

    const resultPanel = document.createElement("div"); resultPanel.className = `guided-result${direct ? " direct-result" : ""}`; resultPanel.setAttribute("aria-live", "polite");
    const resultPosition = render.result_position;
    if (Array.isArray(resultPosition)) {
      resultPanel.style.left = `${Number(resultPosition[0])}px`; resultPanel.style.right = "auto"; resultPanel.style.top = `${Number(resultPosition[1])}px`;
      if (Number(resultPosition[2])) resultPanel.style.width = `${Number(resultPosition[2])}px`;
    }
    const resultLabel = document.createElement("span"); resultLabel.textContent = config.result_heading || "实验结果";
    const primaryResult = document.createElement("strong"); primaryResult.textContent = "正在观察";
    const meters = document.createElement("div"); meters.className = "guided-meters";
    resultPanel.append(resultLabel, primaryResult, meters); lab.append(resultPanel);

    function place(wrapper, inputId, index) {
      const position = render.control_positions?.[inputId] || [[42, 315], [300, 315], [548, 315]][index] || [42 + index * 250, 315];
      wrapper.style.left = `${Number(position[0])}px`; wrapper.style.top = `${Number(position[1])}px`;
      if (Number(position[2])) wrapper.style.width = `${Number(position[2])}px`;
    }

    function applyFocus(outputs) {
      state.guidedFocusId = state.complete ? "" : guidedFocus(config, outputs);
      for (const [inputId, wrapper] of controlWrappers) wrapper.classList.toggle("current-focus", inputId === state.guidedFocusId);
    }

    function update(playSound) {
      try {
        const outputs = ModelEngine.run(config.model_id, state.inputs);
        observeActivation(config, outputs);
        observeThreshold(state.inputs, outputs);
        const mapping = config.visual_outputs || {}, active = Boolean(outputs[mapping.activation_output]);
        const countCard = (config.output_cards || []).find((card) => card.output_id === mapping.amount_output);
        const speedCard = (config.output_cards || []).find((card) => card.output_id === mapping.surplus_output);
        if (direct && config.direct_manipulation?.result_mode === "counter") {
          const amount = Math.max(0, Number(outputs[mapping.amount_output] || 0));
          primaryResult.textContent = active ? String(Math.max(1, Math.round(amount * 5))) : "0";
        } else primaryResult.textContent = active ? (config.active_result_label || "条件已触发") : (config.inactive_result_label || "还没有触发");
        resultPanel.classList.toggle("active", active);
        meters.replaceChildren();
        if (countCard) { const node = document.createElement("span"); node.textContent = `${countCard.label || countCard.output_id}：${thresholdOutputText(countCard, outputs[countCard.output_id])}`; meters.append(node); }
        if (speedCard) { const node = document.createElement("span"); node.textContent = `${speedCard.label || speedCard.output_id}：${thresholdOutputText(speedCard, outputs[speedCard.output_id])}`; meters.append(node); }
        state.result = { kind:"threshold-preview", inputs:{ ...state.inputs }, ...state.inputs, ...outputs, success:null, started_at:performance.now() };
        dom.result.textContent = formatTemplate(config.preview_format || config.result_format, state.result);
        applyFocus(outputs);
        const ready = thresholdSuccess(config.success_rule, outputs);
        resultPanel.classList.toggle("attention", Number(config.focus_after_hint_level || 0) > state.hintLevel && !ready);
        if (ready) {
          state.guidedFocusId = "";
          controlWrappers.forEach((wrapper) => { wrapper.classList.remove("current-focus"); wrapper.classList.add("complete"); });
          if (direct && config.direct_manipulation?.auto_complete && !completionQueued) {
            completionQueued = true;
            const stageId = stage.stage_id, delay = state.reducedMotion ? 80 : Number(config.direct_manipulation?.completion_delay_ms || 520);
            window.setTimeout(() => {
              if (currentStage()?.stage_id !== stageId || state.complete) return;
              finishStage({ kind:"threshold-response", inputs:{ ...state.inputs }, ...state.inputs, ...outputs }, true);
              controlNodes.forEach((node) => { node.disabled = true; });
            }, delay);
          }
        }
        if (check) check.classList.toggle("ready", ready);
        if (playSound) { signalValueFeedback(resultPanel); playCue("adjust"); }
        return outputs;
      } catch (error) {
        showFatal(error.message); return null;
      }
    }

    for (const [index, control] of (config.controls || []).entries()) {
      if (control.type === "range") {
        const wrapper = document.createElement("div"); wrapper.className = direct ? "direct-control-zone" : "guided-control"; wrapper.dataset.inputId = control.input_id;
        if (direct) {
          const bounds = render.direct_control_bounds?.[control.input_id] || render.focus_bounds?.[control.input_id] || [42 + index * 250, 220, 220, 180];
          wrapper.style.left = `${Number(bounds[0])}px`; wrapper.style.top = `${Number(bounds[1])}px`; wrapper.style.width = `${Number(bounds[2])}px`; wrapper.style.height = `${Number(bounds[3])}px`;
        } else place(wrapper, control.input_id, index);
        const label = document.createElement("label"), inputId = `guided-range-${index}`; label.htmlFor = inputId;
        const current = document.createElement("strong"), input = document.createElement("input");
        const initial = Number(control.initial); state.inputs[control.input_id] = initial;
        label.append(control.label || control.input_id, current);
        input.id = inputId; input.type = "range"; input.className = "threshold-range"; input.dataset.inputId = control.input_id;
        input.min = control.min; input.max = control.max; input.step = control.step; input.value = initial;
        const minus = button("−", "threshold-adjust", () => setValue(Number(input.value) - Number(input.step)));
        const plus = button("+", "threshold-adjust", () => setValue(Number(input.value) + Number(input.step)));
        minus.setAttribute("aria-label", `${control.label || control.input_id}减少`); plus.setAttribute("aria-label", `${control.label || control.input_id}增加`);
        const caption = document.createElement("div"); caption.className = "range-caption";
        const left = document.createElement("span"), right = document.createElement("span"); left.textContent = control.low_label || "低"; right.textContent = control.high_label || "高"; caption.append(left, right);
        function setValue(next) {
          recordInteraction();
          restoreActiveStateAfterChange();
          const value = Math.max(Number(input.min), Math.min(Number(input.max), next)); input.value = String(value); state.inputs[control.input_id] = value; current.textContent = controlDisplayText(control, value); update(true);
        }
        input.addEventListener("input", () => setValue(Number(input.value)));
        input.addEventListener("pointerdown", () => { state.guidedFocusId = control.input_id; applyFocus(state.result || {}); });
        current.textContent = controlDisplayText(control, initial);
        if (direct) {
          input.classList.add("direct-range");
          input.setAttribute("aria-label", config.direct_manipulation?.instructions?.[control.input_id] || control.label || control.input_id);
          const affordance = document.createElement("span"); affordance.className = "direct-affordance";
          affordance.append(config.direct_manipulation?.instructions?.[control.input_id] || `拖动${control.label || "仪器"}`);
          const value = document.createElement("strong"); value.textContent = controlDisplayText(control, initial); affordance.append(value);
          input.addEventListener("input", () => { value.textContent = controlDisplayText(control, Number(input.value)); });
          wrapper.append(input, affordance); controlNodes.push(input);
        } else {
          wrapper.append(label, minus, input, plus, caption); controlNodes.push(input, minus, plus);
        }
        lab.append(wrapper); controlWrappers.set(control.input_id, wrapper);
      }
      if (control.type === "choice") {
        const wrapper = document.createElement("div"); wrapper.className = "guided-choice"; wrapper.dataset.inputId = control.input_id; place(wrapper, control.input_id, index);
        const label = document.createElement("span"); label.className = "guided-choice-label"; label.textContent = control.label || control.input_id; wrapper.append(label);
        const options = control.options || [], initial = Number(control.initial ?? options[0]?.value); state.inputs[control.input_id] = initial;
        const buttons = options.map((option) => {
          const node = button(option.label, "threshold-choice", () => { restoreActiveStateAfterChange(); state.inputs[control.input_id] = Number(option.value); buttons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === node))); update(true); });
          node.dataset.inputId = control.input_id; node.dataset.value = String(option.value); node.setAttribute("aria-pressed", String(Number(option.value) === initial)); wrapper.append(node); controlNodes.push(node); return node;
        });
        lab.append(wrapper); controlWrappers.set(control.input_id, wrapper);
      }
    }

    if (!(direct && config.direct_manipulation?.auto_complete)) {
      check = stageSubmitButton(config.button || "记下观察", "primary-button threshold-check guided-check", () => {
        const outputs = update(false); if (!outputs) return;
        const success = thresholdSuccess(config.success_rule, outputs);
        finishStage({ kind:"threshold-response", inputs:{ ...state.inputs }, ...state.inputs, ...outputs }, success);
        if (success) { state.guidedFocusId = ""; check.classList.remove("ready"); controlWrappers.forEach((wrapper) => wrapper.classList.remove("current-focus")); controlNodes.concat(check).forEach((node) => { node.disabled = true; }); }
      });
      lab.append(check);
    }
    dom.controls.append(lab); update(false);
  }

  function renderControls() {
    const stage = currentStage(), interaction = InteractionRegistry.create(stage.interaction.primitive, stage.interaction.config), config = interaction.config;
    dom.deck.classList.remove("stage-complete");
    dom.controls.replaceChildren(); dom.feedbackRow.hidden = false; dom.next.hidden = true; dom.result.textContent = ""; dom.feedback.textContent = stage.feedback.initial || "调整实验，观察画面怎样变化。";
    dom.hint.hidden = !(stage.hints || []).length; dom.hint.textContent = `提示 0/${(stage.hints || []).length}`;
    dom.deeper.hidden = true; dom.next.disabled = true; setUiState(interaction.primitive === "summary" ? "summary" : "active");
    if (interaction.primitive === "dialogue") dom.controls.append(button(config.button || "继续", "primary-button", () => {
      finishStage({ kind: "dialogue" }, true);
      if (config.auto_advance) window.setTimeout(nextStage, state.reducedMotion ? 60 : Number(config.auto_advance_delay_ms || 520));
    }));
    if (interaction.primitive === "release-object") dom.controls.append(button(config.button || "释放", "primary-button", () => {
      try { const outputs = ModelEngine.run(config.model_id, config.inputs || {}); finishStage({ kind: "release", ...outputs }, true); }
      catch (error) { showFatal(error.message); }
    }));
    if (interaction.primitive === "slider-model") {
      const row = document.createElement("div"); row.className = "slider-control";
      const label = document.createElement("label"); label.htmlFor = "model-slider";
      const strong = document.createElement("strong");
      const initial = Number(config.initial); state.inputs[config.input_id] = initial;
      label.append(`${config.label || "数值"}：`, strong); strong.textContent = String(initial);
      const input = document.createElement("input"); input.id = "model-slider"; input.type = "range"; input.min = config.min; input.max = config.max; input.step = config.step || 1; input.value = initial;
      const check = stageSubmitButton(config.button || "检查结果", "primary-button compact", () => {
        try {
          const value = Number(input.value), outputs = ModelEngine.run(config.model_id, modelInputs(config, value));
          finishStage({ kind: "model", input_value: value, ...outputs }, isExpected(config, outputs, value));
        } catch (error) { showFatal(error.message); }
      });
      input.addEventListener("input", () => {
        recordInteraction(); restoreActiveStateAfterChange(); const value = Number(input.value); strong.textContent = String(value); state.inputs[config.input_id] = value;
        try { state.result = { kind: "model-preview", input_value: value, ...ModelEngine.run(config.model_id, modelInputs(config, value)), success: null }; dom.result.textContent = formatTemplate(config.result_format, state.result); }
        catch (error) { dom.result.textContent = error.message; }
        signalValueFeedback(strong);
        playCue("adjust");
      });
      row.append(label, input, check); dom.controls.append(row);
    }
    if (interaction.primitive === "choice-model") {
      const row = document.createElement("div"); row.className = "choice-row";
      for (const option of config.options || []) row.append(button(option.label, "", () => {
        try {
          restoreActiveStateAfterChange();
          state.inputs[config.input_id] = Number(option.value);
          const outputs = ModelEngine.run(config.model_id, modelInputs(config, option.value));
          finishStage({ kind: "model", input_value: option.value, ...outputs }, isExpected(config, outputs, option.value));
        } catch (error) { showFatal(error.message); }
      }));
      dom.controls.append(row);
    }
    if (interaction.primitive === "threshold-response-lab") {
      if (currentCue()?.render?.kind === "guided-threshold-apparatus") renderGuidedThresholdLab(stage, config);
      else renderThresholdResponseLab(stage, config);
    }
    if (interaction.primitive === "orbit-launch") {
      const row = document.createElement("div"); row.className = "choice-row";
      for (const option of config.options || []) row.append(button(option.label, "", () => {
        const simulation = simulateOrbit(config, Number(option.speed));
        finishStage({ kind: "orbit", speed: Number(option.speed), ...simulation }, simulation.outcome === config.expected_outcome);
      }));
      dom.controls.append(row);
    }
    if (interaction.primitive === "summary") {
      dom.feedbackRow.hidden = false; dom.hint.hidden = true; dom.deeper.hidden = false; dom.next.hidden = true;
      dom.feedback.textContent = stage.feedback.initial || "三条规律已经整理好。";
      const summary = document.createElement("div"); summary.className = "summary-card";
      const list = document.createElement("ol");
      for (const point of config.points || []) { const item = document.createElement("li"); item.textContent = point; list.append(item); }
      summary.append(list, button(config.button || "再玩一次", "primary-button compact", replay)); dom.controls.append(summary);
      state.complete = true; setUiState("summary");
    }
  }

  function renderStage() {
    const stage = currentStage(), cue = currentCue();
    const enteredAt = performance.now();
    state.complete = stage.interaction.primitive === "summary"; state.result = null; state.hintLevel = 0; state.inputs = {}; state.evidence = { inputs: {}, outputs: {} };
    state.hotspotId = ""; state.hotspotLocked = false; state.hotspotAnimationId = ""; state.hotspotFocusedAt = 0; state.hotspotTouchId = ""; state.hotspotTouchAt = 0; state.feedbackBeforeHotspot = "";
    dom.app.classList.remove("hotspot-preview", "hotspot-explained");
    state.strongFeedbackKeys = new Set(); state.lastValueFeedbackAt = 0; state.lastFailureFeedbackAt = 0;
    state.stageEnteredAt = enteredAt; state.lastInteractionAt = enteredAt; state.firstActivationSeen = false; state.activationWasActive = null;
    state.stageAnimationId = String(cue?.character_animation || ""); state.characterTransient = null;
    state.characterPlayback = { signature:"", startedAt:enteredAt, finished:false }; state.characterDisplayKey = "";
    state.motion.shakeUntil = 0; state.motion.flashUntil = 0; state.motion.particles = [];
    const thresholdActive = stage.interaction.primitive === "threshold-response-lab";
    const guidedActive = cue?.render?.kind === "guided-threshold-apparatus";
    const directActive = guidedActive && Boolean(stage.interaction.config?.direct_manipulation);
    state.guidedFocusId = guidedActive ? guidedFocus(stage.interaction.config || {}, {}) : "";
    dom.deck.classList.toggle("threshold-active", thresholdActive && !guidedActive); dom.subtitle.classList.toggle("threshold-active", thresholdActive && !guidedActive);
    dom.deck.classList.toggle("guided-active", guidedActive); dom.subtitle.classList.toggle("guided-active", guidedActive);
    dom.deck.classList.toggle("direct-active", directActive);
    dom.deck.classList.toggle("dialogue-active", stage.interaction.primitive === "dialogue");
    dom.subtitle.classList.toggle("dialogue-active", stage.interaction.primitive === "dialogue");
    dom.deck.classList.toggle("summary-active", stage.interaction.primitive === "summary");
    dom.count.textContent = `第 ${stage.progress_index} / ${PACK.experience.progress_segments} 段`;
    dom.title.textContent = stage.title; dom.prompt.textContent = stage.prompt; dom.subtitle.textContent = state.subtitles ? stage.learning.observation : "";
    updatePortrait(stage.stage_id === "summary" ? "celebrating" : "neutral");
    renderProgress(); renderJourney(); renderControls(); renderHotspots(); updateStatus();
  }

  function nextStage() {
    if (!state.complete || state.stageIndex >= PACK.experience.stages.length - 1) return;
    state.stageIndex += 1; playCue("click"); renderStage();
  }
  function replay() {
    state.started = false; state.stageIndex = 0; state.complete = false; state.result = null;
    dom.startCard.hidden = false; dom.copy.hidden = true; dom.deck.hidden = true; renderStage();
  }
  function revealHint() {
    const hints = currentStage().hints || [];
    if (!hints.length) return;
    state.hintLevel = Math.min(hints.length, state.hintLevel + 1);
    dom.hint.textContent = `提示 ${state.hintLevel}/${hints.length}`;
    dom.feedback.textContent = `提示${state.hintLevel}：${hints[state.hintLevel - 1]}`;
    const config = currentStage().interaction.config || {};
    if (currentCue()?.render?.kind === "guided-threshold-apparatus") {
      state.guidedFocusId = guidedFocus(config, state.result || {});
      document.querySelectorAll(".guided-control,.guided-choice,.direct-control-zone").forEach((wrapper) => wrapper.classList.toggle("current-focus", wrapper.dataset.inputId === state.guidedFocusId));
    }
    queueCharacterAnimation(currentCue()?.feedback?.hint_animation || "think", true);
    playCue("click");
  }

  function openModal(kind) {
    clearHotspot(); state.modalKind = kind; dom.modal.hidden = false; dom.modalBody.replaceChildren();
    hotspotLayer.querySelectorAll("button").forEach((node) => { node.tabIndex = -1; node.style.pointerEvents = "none"; });
    if (kind === "settings") {
      dom.modalEyebrow.textContent = "本地体验设置"; dom.modalTitle.textContent = "体验设置";
      [["静音", "muted"], ["显示字幕", "subtitles"], ["减少动态效果", "reducedMotion"]].forEach(([labelText, key]) => {
        const label = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.checked = state[key];
        input.addEventListener("change", () => { state[key] = input.checked; if (key === "reducedMotion") state.reducedMotionOverridden = true; dom.app.classList.toggle("reduce-motion", state.reducedMotion); dom.subtitle.textContent = state.subtitles ? (state.complete ? currentStage().learning.core : currentStage().learning.observation) : ""; updateStatus(); });
        label.append(labelText, input); dom.modalBody.append(label);
      });
    } else {
      dom.modalEyebrow.textContent = "高中拓展 · 不影响通关"; dom.modalTitle.textContent = "深入一步";
      const paragraph = document.createElement("p"); paragraph.textContent = currentStage().learning.deeper; dom.modalBody.append(paragraph);
    }
    dom.modal.querySelector("input, button")?.focus();
  }
  function closeModal() {
    dom.modal.hidden = true; state.modalKind = "";
    hotspotLayer.querySelectorAll("button").forEach((node) => { node.tabIndex = 0; node.style.pointerEvents = "auto"; });
    dom.settings.focus();
  }
  function showFatal(message) { dom.fatal.hidden = false; dom.fatalMessage.textContent = message; window.__PIXEL_SCIENCE_STATUS__ = { ready: false, errors: [message] }; }

  function drawSprite(context, assetId, x, y, width, height) {
    const image = images.get(assetId); if (image) context.drawImage(image, Math.round(x), Math.round(y), Math.round(width), Math.round(height || width));
  }

  function drawRotatedSprite(context, assetId, x, y, width, height, radians) {
    const image = images.get(assetId); if (!image) return;
    const resolvedHeight = Number(height || width);
    context.save(); context.translate(x + width / 2, y + resolvedHeight / 2); context.rotate(radians || 0);
    context.drawImage(image, -width / 2, -resolvedHeight / 2, width, resolvedHeight); context.restore();
  }

  function updatePortrait(pose) {
    const assetId = PACK.visuals.character?.portraits?.[pose] || PACK.visuals.character?.portraits?.neutral;
    if (!assetId) { dom.portrait.hidden = true; return; }
    dom.portrait.src = assetUrl(assetId); dom.portrait.hidden = false;
  }

  function cameraOffset(now) {
    if (state.reducedMotion || now >= state.motion.shakeUntil || state.motion.shakePx <= 0) return [0, 0];
    const elapsed = now - state.motion.shakeStartedAt, phase = Math.floor(elapsed / 18);
    const fade = clamp((state.motion.shakeUntil - now) / Math.max(1, state.motion.shakeUntil - state.motion.shakeStartedAt), 0, 1);
    const amount = state.motion.shakePx * fade;
    return [(phase % 2 ? -1 : 1) * amount, (phase % 3 ? 0 : 1) * amount];
  }

  function drawMotionEffects(context, now) {
    state.motion.particles = state.motion.particles.filter((particle) => now - particle.born < particle.life);
    for (const particle of state.motion.particles) {
      const elapsed = (now - particle.born) / 1000, progress = clamp((now - particle.born) / particle.life, 0, 1);
      context.globalAlpha = 1 - progress;
      context.fillStyle = particle.color;
      context.fillRect(Math.round(particle.x + particle.vx * elapsed), Math.round(particle.y + particle.vy * elapsed + 48 * elapsed * elapsed), particle.size, particle.size);
    }
    context.globalAlpha = 1;
    if (now < state.motion.flashUntil) {
      const duration = Math.max(1, state.motion.flashUntil - state.motion.flashStartedAt);
      const flashLimit = clamp(motionContract().screen_flash_max_alpha ?? .12, 0, .12);
      const alpha = flashLimit * clamp((state.motion.flashUntil - now) / duration, 0, 1);
      context.save(); context.globalAlpha = alpha; context.fillStyle = state.motion.flashColor; context.fillRect(0, 0, 960, 540); context.restore();
    }
  }

  function hotspotMaskOutline(assetId) {
    if (!assetId) return null;
    if (maskOutlineCache.has(assetId)) return maskOutlineCache.get(assetId);
    const image = images.get(assetId); if (!image) return null;
    const canvas = document.createElement("canvas"); canvas.width = 960; canvas.height = 540;
    const context = canvas.getContext("2d"); context.imageSmoothingEnabled = false;
    const offsets = [[-2,0],[2,0],[0,-2],[0,2],[-2,-2],[-2,2],[2,-2],[2,2]];
    for (const [x, y] of offsets) context.drawImage(image, x, y, 960, 540);
    context.globalCompositeOperation = "source-in"; context.fillStyle = COLORS.action; context.fillRect(0, 0, 960, 540);
    context.globalCompositeOperation = "destination-out"; context.drawImage(image, 0, 0, 960, 540);
    context.globalCompositeOperation = "source-over"; maskOutlineCache.set(assetId, canvas);
    return canvas;
  }

  function traceHotspot(context, hotspot) {
    const polygon = hotspotPolygon(hotspot), rect = hotspotRect(hotspot);
    if (!rect) return false;
    context.beginPath();
    if (polygon) {
      polygon.forEach((point, index) => index ? context.lineTo(point[0], point[1]) : context.moveTo(point[0], point[1]));
      context.closePath();
    } else context.rect(rect[0], rect[1], rect[2], rect[3]);
    return true;
  }

  function fitLabel(context, text, maximumWidth) {
    if (context.measureText(text).width <= maximumWidth) return text;
    let value = text;
    while (value.length > 1 && context.measureText(`${value}…`).width > maximumWidth) value = value.slice(0, -1);
    return `${value}…`;
  }

  function wrapLabel(context, text, maximumWidth, maximumLines = 2) {
    const characters = [...String(text || "")], lines = []; let line = "";
    for (const character of characters) {
      const next = `${line}${character}`;
      if (line && context.measureText(next).width > maximumWidth) { lines.push(line); line = character; }
      else line = next;
      if (lines.length === maximumLines) break;
    }
    if (line && lines.length < maximumLines) lines.push(line);
    if (lines.join("").length < characters.length && lines.length) lines[lines.length - 1] = fitLabel(context, `${lines[lines.length - 1]}…`, maximumWidth);
    return lines;
  }

  function attentionHotspot(cue) {
    const attention = cue?.attention;
    if (!attention) return null;
    const id = String(state.complete ? (attention.result_target_id || attention.primary_hotspot_id || "") : (attention.primary_hotspot_id || ""));
    return cueHotspots(cue).find((hotspot, index) => hotspotId(hotspot, index) === id) || null;
  }

  function drawAttentionMask(context, cue) {
    const attention = cue?.attention, hotspot = attentionHotspot(cue), rect = hotspotRect(hotspot);
    if (!attention || !rect) return;
    const dim = clamp(attention.dim_nonessential ?? .16, 0, .35), padding = 18;
    context.save();
    context.fillStyle = `rgba(3,4,3,${dim})`;
    context.beginPath();
    context.rect(0, 54, 960, 326);
    context.rect(Math.max(0, rect[0] - padding), Math.max(54, rect[1] - padding), Math.min(960 - Math.max(0, rect[0] - padding), rect[2] + padding * 2), Math.min(380 - Math.max(54, rect[1] - padding), rect[3] + padding * 2));
    context.fill("evenodd");
    context.restore();
  }

  function drawAttentionMarker(context, cue) {
    if (state.hotspotId) return;
    const hotspot = attentionHotspot(cue), rect = hotspotRect(hotspot); if (!rect) return;
    const [x, y, width, height] = rect, length = 9;
    context.save(); context.globalAlpha = .54; context.strokeStyle = state.complete ? COLORS.result : COLORS.brass; context.lineWidth = 1.5; context.beginPath();
    context.moveTo(x, y + length); context.lineTo(x, y); context.lineTo(x + length, y);
    context.moveTo(x + width - length, y); context.lineTo(x + width, y); context.lineTo(x + width, y + length);
    context.moveTo(x + width, y + height - length); context.lineTo(x + width, y + height); context.lineTo(x + width - length, y + height);
    context.moveTo(x + length, y + height); context.lineTo(x, y + height); context.lineTo(x, y + height - length);
    context.stroke(); context.restore();
  }

  function drawHotspotOverlay(context, now) {
    if (!state.started || !state.hotspotId) return;
    if (!state.hotspotLocked && now - state.hotspotFocusedAt < 140) return;
    const hotspot = currentHotspot(); if (!hotspot) return;
    const rect = hotspotRect(hotspot); if (!rect) return;
    context.save();
    const pulse = state.reducedMotion ? .9 : .72 + .18 * (1 + Math.sin(now / 180)) / 2;
    const outline = hotspotMaskOutline(hotspotMaskAsset(hotspot));
    if (outline) {
      context.globalAlpha = pulse;
      if (state.hotspotLocked) context.filter = "sepia(1) saturate(.85) hue-rotate(345deg) brightness(.85)";
      context.drawImage(outline, 0, 0, 960, 540); context.filter = "none";
    }
    if (traceHotspot(context, hotspot)) {
      if (!outline) { context.globalAlpha = pulse; context.strokeStyle = state.hotspotLocked ? COLORS.brass : COLORS.action; context.lineWidth = 3; context.setLineDash(state.hotspotLocked ? [] : [7, 5]); context.stroke(); }
      context.globalAlpha = state.hotspotLocked ? .08 : .055; context.fillStyle = state.hotspotLocked ? COLORS.brass : COLORS.action; context.fill();
    }
    const rawText = String(hotspot.label || state.hotspotId);
    context.setLineDash([]); context.globalAlpha = 1; context.font = '14px "Science Body", sans-serif';
    const description = state.hotspotLocked ? String(hotspot.description || "") : "";
    const text = fitLabel(context, rawText, 230), descriptionLines = state.hotspotLocked ? wrapLabel(context, description, 260, 2) : [];
    const width = state.hotspotLocked ? 286 : Math.min(250, Math.ceil(context.measureText(text).width) + 20), height = state.hotspotLocked ? 37 + descriptionLines.length * 18 : 30;
    const preferred = Array.isArray(hotspot.label_position) ? hotspot.label_position.map(Number) : [rect[0] + rect[2] / 2 - width / 2, rect[1] - height - 10];
    let x = clamp(preferred[0], 8, 960 - width - 8), y = preferred[1];
    if (y < 54) y = rect[1] + rect[3] + 10;
    y = clamp(y, 54, 406 - height);
    context.fillStyle = "rgba(14,18,17,.94)"; context.fillRect(Math.round(x), Math.round(y), width, height);
    context.strokeStyle = state.hotspotLocked ? COLORS.brass : COLORS.action; context.lineWidth = 1; context.strokeRect(Math.round(x) + .5, Math.round(y) + .5, width - 1, height - 1);
    context.fillStyle = COLORS.text; context.textBaseline = "middle"; context.font = '14px "Science Body", sans-serif'; context.fillText(text, Math.round(x) + 10, Math.round(y) + (state.hotspotLocked ? 16 : height / 2));
    if (state.hotspotLocked) {
      context.fillStyle = "#D8C9BC"; context.font = '12px "Science Body", sans-serif';
      descriptionLines.forEach((line, index) => context.fillText(line, Math.round(x) + 10, Math.round(y) + 36 + index * 17));
    }
    context.restore();
  }

  function draw(now) {
    const context = dom.canvas.getContext("2d"); context.imageSmoothingEnabled = false; context.clearRect(0, 0, 960, 540);
    const cue = currentCue();
    const offset = cameraOffset(now); context.save(); context.translate(offset[0], offset[1]);
    for (const layer of cue.background_layers || []) drawSprite(context, layer, 0, Number(cue.background_offset_y || 0), 960, 540);
    drawEnvironmentLoops(context, cue, now);
    if (!["threshold-apparatus", "integrated-threshold-scene", "guided-threshold-apparatus", "guided-apparatus"].includes(cue?.render?.kind)) { context.fillStyle = "rgba(9,13,13,.16)"; context.fillRect(0, 54, 960, 326); }
    drawAttentionMask(context, cue); drawCharacter(context, cue, now); drawRender(context, cue, now); drawAttentionMarker(context, cue);
    context.restore(); drawMotionEffects(context, now); drawHotspotOverlay(context, now);
    animationRequest = requestAnimationFrame(draw);
  }

  function drawEnvironmentLoops(context, cue, now) {
    const time = state.reducedMotion ? 0 : now / 1000;
    for (const loop of cue.environment_loops || []) {
      if (loop === "star-twinkle" || loop === "dust-motes") {
        const count = loop === "star-twinkle" ? 10 : 7;
        context.fillStyle = loop === "star-twinkle" ? COLORS.result : "#d8c9bc";
        for (let index = 0; index < count; index += 1) {
          const x = 300 + ((index * 83) % 610), y = 86 + ((index * 47) % 236), pulse = state.reducedMotion ? .28 : .2 + .32 * (1 + Math.sin(time * 1.6 + index)) / 2;
          context.globalAlpha = pulse; context.fillRect(Math.round(x), Math.round(y), index % 3 === 0 ? 2 : 1, index % 3 === 0 ? 2 : 1);
        }
        context.globalAlpha = 1;
      }
      if (loop === "instrument-blink" || loop === "telescope-glint") {
        context.fillStyle = COLORS.action; context.globalAlpha = state.reducedMotion ? .2 : .2 + .55 * (1 + Math.sin(time * 2.2)) / 2;
        context.fillRect(loop === "instrument-blink" ? 846 : 808, loop === "instrument-blink" ? 222 : 174, 3, 3); context.globalAlpha = 1;
      }
      if (loop === "branch-sway") {
        const offset = state.reducedMotion ? 0 : Math.round(Math.sin(time * 1.2) * 2);
        context.strokeStyle = "#8d9b7e"; context.globalAlpha = .24; context.lineWidth = 2; context.beginPath(); context.moveTo(650, 116); context.lineTo(688 + offset, 132); context.stroke(); context.globalAlpha = 1;
      }
      if (loop === "firefly-drift") {
        context.fillStyle = COLORS.result;
        for (let index = 0; index < 4; index += 1) {
          const x = 520 + index * 78 + (state.reducedMotion ? 0 : Math.sin(time * .8 + index) * 9), y = 238 + (index % 2) * 42 + (state.reducedMotion ? 0 : Math.cos(time + index) * 7);
          context.globalAlpha = .25 + (state.reducedMotion ? 0 : .35 * (1 + Math.sin(time * 2 + index)) / 2); context.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
        context.globalAlpha = 1;
      }
    }
  }

  function idleCharacterFrame(metadata, now) {
    const animation = metadata.animations?.idle; if (!animation) return null;
    const frames = Math.max(1, Number(animation.frames || 1)), fps = Math.max(.1, Number(animation.fps || 6));
    const frame = state.reducedMotion ? 0 : Math.floor((now - state.stageEnteredAt) / 1000 * fps) % frames;
    return { id:"idle", animation, frame };
  }

  function resolveCharacterFrame(metadata, now) {
    const candidates = [];
    if (state.characterTransient) candidates.push({ id:state.characterTransient.id, signature:`transient:${state.characterTransient.token}`, once:state.characterTransient.once, source:"transient", token:state.characterTransient.token });
    if (state.hotspotId && (state.hotspotLocked || now - state.hotspotFocusedAt >= 140)) candidates.push({ id:state.hotspotAnimationId || (state.hotspotLocked ? "talk" : "point"), signature:`hotspot:${state.hotspotId}:${state.hotspotLocked ? "locked" : "focus"}`, once:false, source:"hotspot" });
    const cue = currentCue(), character = PACK.visuals.character || {};
    const thinkAfter = clamp(character.think_after_ms ?? 0, 0, 60000);
    const inactive = thinkAfter > 0 && !state.complete && now - Math.max(state.stageEnteredAt, state.lastInteractionAt) >= thinkAfter;
    if (state.stageAnimationId && !inactive) {
      const mode = String(cue?.character_animation_mode || cue?.character_animation_behavior || "");
      candidates.push({
        id:state.stageAnimationId,
        signature:`stage:${currentStage()?.stage_id || state.stageIndex}:${state.stageAnimationId}:${mode}`,
        once:mode === "once",
        forceLoop:mode === "loop" || cue?.character_animation_loop === true,
        hold:mode === "hold" || cue?.character_animation_hold === true,
        source:"stage"
      });
    }
    if (inactive) candidates.push({ id:"think", signature:`inactivity:${currentStage()?.stage_id || state.stageIndex}`, once:false, source:"inactivity" });
    candidates.push({ id:"idle", signature:`idle:${currentStage()?.stage_id || state.stageIndex}`, once:false, source:"idle" });
    const sourcePriority = { transient:4, hotspot:3, stage:2, inactivity:1, idle:0 };
    candidates.sort((left, right) => (sourcePriority[right.source] - sourcePriority[left.source]) || characterPriority(right.id, metadata) - characterPriority(left.id, metadata));
    const selected = candidates.find((candidate) => metadata.animations?.[candidate.id]) || { id:"idle", signature:"idle:fallback", once:false, source:"idle" };
    const animation = metadata.animations?.[selected.id] || metadata.animations?.idle; if (!animation) return null;
    if (state.characterPlayback.signature !== selected.signature) state.characterPlayback = { signature:selected.signature, startedAt:now, finished:false };
    if (state.characterPlayback.finished) return selected.hold ? { id:selected.id, animation, frame:Math.max(0, Number(animation.frames || 1) - 1) } : idleCharacterFrame(metadata, now);
    const frames = Math.max(1, Number(animation.frames || 1)), fps = Math.max(.1, Number(animation.fps || 6));
    const realElapsed = Math.max(0, now - state.characterPlayback.startedAt) / 1000, elapsed = state.reducedMotion ? 0 : realElapsed;
    const playOnce = !selected.forceLoop && (Boolean(selected.once) || animation.loop === false);
    if (playOnce && realElapsed >= (state.reducedMotion ? .15 : frames / fps)) {
      state.characterPlayback.finished = true;
      if (selected.source === "transient" && state.characterTransient?.token === selected.token) state.characterTransient = null;
      return idleCharacterFrame(metadata, now);
    }
    const frame = state.reducedMotion ? 0 : playOnce ? Math.min(frames - 1, Math.floor(elapsed * fps)) : Math.floor(elapsed * fps) % frames;
    return { id:selected.id, animation, frame };
  }

  function drawCharacter(context, cue, now) {
    const character = PACK.visuals.character || {}, atlas = images.get(character.atlas_asset), metadata = PACK.asset_metadata?.[character.metadata_asset];
    if (!atlas || !metadata) return;
    const resolved = resolveCharacterFrame(metadata, now); if (!resolved) return;
    const displayKey = `${currentStage()?.stage_id || ""}:${resolved.id}`;
    if (state.characterDisplayKey !== displayKey) {
      state.characterDisplayKey = displayKey;
      const events = window.__PIXEL_SCIENCE_EVENTS__ ||= [];
      events.push({ type:"character-animation", animation_id:resolved.id, stage_id:currentStage()?.stage_id || "", frame:resolved.frame, at:performance.now() });
      if (events.length > 160) events.splice(0, events.length - 160);
    }
    window.__PIXEL_SCIENCE_CHARACTER__ = { animation_id:resolved.id, frame:resolved.frame, stage_id:currentStage()?.stage_id || "" };
    const cell = metadata.cell_size || [128, 128], position = cue.character_position || character.position || [56, 170], size = Number(character.render_size || 180);
    const pivot = metadata.pivot || [cell[0] / 2, cell[1] * .875];
    const footX = position[0] + size * Number(pivot[0]) / Number(cell[0]);
    const footY = position[1] + size * Number(pivot[1]) / Number(cell[1]);
    context.save();
    context.fillStyle = "rgba(0,0,0,.34)";
    context.beginPath();
    context.ellipse(Math.round(footX), Math.round(footY + 2), Math.round(size * .12), Math.max(3, Math.round(size * .022)), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.drawImage(atlas, resolved.frame * cell[0], Number(resolved.animation.row) * cell[1], cell[0], cell[1], position[0], position[1], size, size);
  }

  function lightBeamColor(render, value) {
    for (const stop of render.beam_color_stops || []) if (Number(value) <= Number(stop.max)) return String(stop.color);
    return String(render.beam_default_color || COLORS.result);
  }

  function drawFocusBrackets(context, bounds, now) {
    if (!bounds) return;
    const pulse = state.reducedMotion ? .86 : .72 + .14 * (1 + Math.sin(now / 220)) / 2;
    const [x, y, width, height] = bounds, length = 18;
    context.save(); context.globalAlpha = pulse; context.strokeStyle = COLORS.action; context.lineWidth = 3; context.beginPath();
    context.moveTo(x, y + length); context.lineTo(x, y); context.lineTo(x + length, y);
    context.moveTo(x + width - length, y); context.lineTo(x + width, y); context.lineTo(x + width, y + length);
    context.moveTo(x + width, y + height - length); context.lineTo(x + width, y + height); context.lineTo(x + width - length, y + height);
    context.moveTo(x + length, y + height); context.lineTo(x, y + height); context.lineTo(x, y + height - length);
    context.stroke(); context.restore();
  }

  function drawGuidedApparatus(context, render, now) {
    const positions = render.asset_positions || {};
    const guide = [...(positions.guide || [60, 70, 180, 164])], lamp = positions.lamp || [22, 188, 300, 281];
    const filter = positions.filter || [305, 208, 226, 226], apparatus = positions.apparatus || [448, 198, 490, 230];
    if (!state.reducedMotion && state.result?.success === true) guide[1] -= 3 + Math.round(Math.sin(now / 120) * 2);
    if (!state.reducedMotion && state.result?.success === false) guide[0] += Math.round(Math.sin(now / 42) * 2);
    drawSprite(context, render.guide_asset, ...guide);
    drawSprite(context, render.lamp_asset, ...lamp);

    const config = currentStage().interaction.config || {};
    const amountInput = render.amount_input || config.controls?.[0]?.input_id || "";
    const colorInput = render.beam_color_input || config.controls?.[1]?.input_id || amountInput;
    const amount = Number(state.inputs[amountInput] ?? config.fixed_inputs?.[amountInput] ?? 1);
    const colorValue = Number(state.inputs[colorInput] ?? config.fixed_inputs?.[colorInput] ?? 0);
    const amountBounds = (config.controls || []).find((control) => control.input_id === amountInput) || { min:.25, max:2 };
    const amountRatio = Math.max(0, Math.min(1, (amount - Number(amountBounds.min)) / Math.max(.001, Number(amountBounds.max) - Number(amountBounds.min))));
    const beam = render.beam || { start:[280, 316], end:[503, 316] };
    context.save(); context.strokeStyle = lightBeamColor(render, colorValue); context.lineCap = "butt"; context.lineWidth = 3 + amountRatio * 5; context.globalAlpha = .3 + amountRatio * .58;
    context.beginPath(); context.moveTo(beam.start[0], beam.start[1]); context.lineTo(beam.end[0], beam.end[1]); context.stroke(); context.restore();

    if (render.filter_asset) {
      const control = (config.controls || []).find((candidate) => candidate.input_id === colorInput);
      const minimum = Number(control?.min || 0), maximum = Number(control?.max || 1);
      const ratio = Math.max(0, Math.min(1, (colorValue - minimum) / Math.max(.001, maximum - minimum)));
      drawRotatedSprite(context, render.filter_asset, ...filter, ratio * Math.PI * 1.15);
    }
    drawSprite(context, render.apparatus_asset, ...apparatus);

    const mapping = config.visual_outputs || {}, active = Boolean(state.result?.[mapping.activation_output]);
    if (active) {
      const count = Math.max(2, Math.min(12, Math.round(Number(state.result?.[mapping.amount_output] || 1) * 5)));
      const speed = Math.max(.3, Math.min(1.4, Number(state.result?.[mapping.surplus_output] || .3)));
      for (let index = 0; index < count; index += 1) {
        const cycle = state.reducedMotion ? .62 : (now / 900 * speed + index / count) % 1;
        const x = apparatus[0] + apparatus[2] * (.34 + cycle * .39), y = apparatus[1] + apparatus[3] * (.34 + (index % 4) * .09);
        context.fillStyle = COLORS.result; context.globalAlpha = .55 + (index % 3) * .14; context.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
      context.globalAlpha = 1;
    } else if (state.result) {
      context.fillStyle = COLORS.danger; context.globalAlpha = .85; context.fillRect(Math.round(beam.end[0] - 2), Math.round(beam.end[1] - 7), 4, 14); context.globalAlpha = 1;
    }

    const focusBounds = render.focus_bounds || {};
    drawFocusBrackets(context, focusBounds[state.guidedFocusId], now);
  }

  function drawIntegratedThresholdScene(context, render, now) {
    const config = currentStage().interaction.config || {}, mapping = config.visual_outputs || {};
    const amountInput = render.amount_input || config.controls?.[0]?.input_id || "";
    const colorInput = render.beam_color_input || config.controls?.[1]?.input_id || amountInput;
    const amount = Number(state.inputs[amountInput] ?? config.fixed_inputs?.[amountInput] ?? 1);
    const colorValue = Number(state.inputs[colorInput] ?? config.fixed_inputs?.[colorInput] ?? 0);
    const amountBounds = (config.controls || []).find((control) => control.input_id === amountInput) || { min:.25, max:2 };
    const amountRatio = Math.max(0, Math.min(1, (amount - Number(amountBounds.min)) / Math.max(.001, Number(amountBounds.max) - Number(amountBounds.min))));
    const active = Boolean(state.result?.[mapping.activation_output]);
    const beam = render.beam || { start:[252,205], end:[500,205] };

    context.save();
    context.strokeStyle = lightBeamColor(render, colorValue);
    context.lineCap = "butt";
    context.lineWidth = 2 + amountRatio * 4;
    context.globalAlpha = .34 + amountRatio * .56;
    context.beginPath(); context.moveTo(beam.start[0], beam.start[1]); context.lineTo(beam.end[0], beam.end[1]); context.stroke();
    context.restore();

    const materialInput = String(render.material_variant_input || "");
    if (materialInput && Array.isArray(render.material_variants)) {
      const materialValue = Number(state.inputs[materialInput] ?? config.fixed_inputs?.[materialInput]);
      const variant = render.material_variants.find((entry) => Math.abs(Number(entry.value) - materialValue) <= 1e-8);
      const plate = render.material_variant_rect || [490, 148, 46, 116];
      if (variant) {
        context.save();
        context.globalAlpha = .26;
        context.fillStyle = String(variant.color || "#B87924");
        context.fillRect(plate[0], plate[1], plate[2], plate[3]);
        context.globalAlpha = .92;
        context.strokeStyle = String(variant.color || "#B87924");
        context.lineWidth = 2;
        context.strokeRect(plate[0] + 1, plate[1] + 1, plate[2] - 2, plate[3] - 2);
        context.fillStyle = "#F0E9E1";
        context.font = '700 14px "Science Body", sans-serif';
        context.textAlign = "center";
        context.fillText(String(variant.label || ""), plate[0] + plate[2] / 2, plate[1] - 8);
        context.restore();
      }
    }

    const electronPath = render.electron_path || { start:[523,205], end:[722,205] };
    if (active) {
      const count = Math.max(2, Math.min(12, Math.round(Number(state.result?.[mapping.amount_output] || 1) * 5)));
      const speed = Math.max(.35, Math.min(1.4, Number(state.result?.[mapping.surplus_output] || .35)));
      for (let index = 0; index < count; index += 1) {
        const cycle = state.reducedMotion ? (index + 1) / (count + 1) : (now / 850 * speed + index / count) % 1;
        const x = electronPath.start[0] + (electronPath.end[0] - electronPath.start[0]) * cycle;
        const y = electronPath.start[1] + Math.sin((cycle + index) * Math.PI * 2) * (5 + index % 3 * 3);
        context.fillStyle = COLORS.result; context.globalAlpha = .58 + (index % 3) * .13;
        context.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
      context.globalAlpha = 1;
    }

    const pivot = render.meter_pivot || [836,315], radius = Number(render.meter_radius || 26);
    const angle = active ? -.35 : -2.25;
    context.save(); context.translate(pivot[0], pivot[1]); context.rotate(angle);
    context.strokeStyle = active ? COLORS.result : "#8d887d"; context.lineWidth = 2; context.beginPath(); context.moveTo(0,0); context.lineTo(radius,0); context.stroke(); context.restore();

    if (state.result?.success === true) {
      const elapsed = now - Number(state.result.started_at || now), pulse = state.reducedMotion ? .45 : Math.max(0, 1 - elapsed / 520);
      if (pulse > 0) {
        context.save(); context.strokeStyle = COLORS.result; context.globalAlpha = pulse; context.lineWidth = 3;
        context.beginPath(); context.arc(electronPath.start[0], electronPath.start[1], 8 + (1 - pulse) * 20, 0, Math.PI * 2); context.stroke(); context.restore();
      }
    }
  }

  function drawRender(context, cue, now) {
    const render = cue.render || {};
    for (const prop of cue.props || []) drawSprite(context, prop.asset, prop.x, prop.y, prop.width, prop.height);
    if (render.kind === "integrated-threshold-scene") drawIntegratedThresholdScene(context, render, now);
    if (["threshold-apparatus", "guided-threshold-apparatus", "guided-apparatus"].includes(render.kind)) drawGuidedApparatus(context, render, now);
    if (render.kind === "release") {
      const duration = state.reducedMotion ? 1 : Math.max(500, Number(state.result?.[render.duration_output] || 1) * 1000);
      const progress = state.result?.kind === "release" ? Math.min(1, (now - state.result.started_at) / duration) : 0;
      drawSprite(context, render.prop_asset, render.x, render.start_y + progress * progress * (render.ground_y - render.start_y - render.size), render.size);
    }
    if (render.kind === "force") {
      const value = Number(state.inputs[render.input_id] ?? render.initial ?? 1), ratio = Math.min(1, Math.max(.2, value / Number(render.max || value)));
      const forceRatio = Number(state.result?.force_ratio ?? (render.force_from_input ? value : 1));
      const forceStrength = Math.min(1, Math.max(.12, forceRatio / Number(render.force_reference || 1)));
      const separation = Number(render.min_separation || 100) + ratio * Number(render.separation_range || 170), centerX = Number(render.center_x || 700), y = Number(render.y || 300);
      const leftX = centerX - separation / 2, rightX = centerX + separation / 2;
      context.strokeStyle = state.result?.success ? COLORS.result : COLORS.action; context.globalAlpha = .24 + forceStrength * .66; context.lineWidth = 2 + forceStrength * 7; context.beginPath(); context.moveTo(leftX + 18, y + 18); context.lineTo(rightX + 18, y + 18); context.stroke(); context.globalAlpha = 1;
      const rightSize = render.scale_right_from_input ? 30 + Math.sqrt(Math.max(.1, value)) * 12 : 38;
      drawSprite(context, render.left_asset, leftX, y, 38); drawSprite(context, render.right_asset, rightX, y + (38 - rightSize), rightSize);
    }
    if (render.kind === "threshold-response") {
      const config = currentStage().interaction.config || {}, mapping = config.visual_outputs || {};
      const active = Boolean(state.result?.[mapping.activation_output]), amount = Math.max(0, Number(state.result?.[mapping.amount_output] || 0));
      const surplus = Math.max(0, Number(state.result?.[mapping.surplus_output] || 0));
      const sourceAmount = Math.max(.25, Number(state.inputs[render.amount_input] || 1));
      const x = Number(render.x || 390), y = Number(render.y || 190), width = Number(render.width || 500), height = Number(render.height || 156), barrierX = x + width * .58;
      const time = state.reducedMotion ? 0 : now / 1000;
      context.fillStyle = "rgba(19,25,24,.72)"; context.fillRect(x, y, width, height);
      context.strokeStyle = "#59625a"; context.lineWidth = 2; context.strokeRect(x, y, width, height);
      context.fillStyle = "#8d9b7e"; context.fillRect(barrierX, y + 15, 8, height - 30);
      const sourceCount = Math.max(2, Math.min(10, Math.round(sourceAmount * 4)));
      for (let index = 0; index < sourceCount; index += 1) {
        const laneY = y + 28 + (index % 4) * 29, cycle = state.reducedMotion ? .78 : (time * .65 + index / sourceCount) % 1;
        const particleX = x + 20 + cycle * (barrierX - x - 28);
        context.fillStyle = COLORS.action; context.fillRect(Math.round(particleX), Math.round(laneY), 7, 7);
      }
      if (active) {
        const responseCount = Math.max(1, Math.min(10, Math.round(amount * 4)));
        for (let index = 0; index < responseCount; index += 1) {
          const laneY = y + 25 + (index % 4) * 30, cycle = state.reducedMotion ? .62 : (time * (.45 + Math.min(1.2, surplus) * .18) + index / responseCount) % 1;
          const responseX = barrierX + 18 + cycle * (x + width - barrierX - 34);
          context.fillStyle = COLORS.result; context.beginPath(); context.arc(Math.round(responseX), Math.round(laneY), 4, 0, Math.PI * 2); context.fill();
        }
      } else {
        context.strokeStyle = COLORS.danger; context.lineWidth = 3; context.beginPath(); context.moveTo(barrierX - 12, y + height / 2 - 8); context.lineTo(barrierX - 2, y + height / 2 + 2); context.moveTo(barrierX - 2, y + height / 2 - 8); context.lineTo(barrierX - 12, y + height / 2 + 2); context.stroke();
      }
    }
    if (render.kind === "orbit") {
      const center = render.center || [758, 252]; drawSprite(context, render.body_asset, center[0] - 58, center[1] - 58, 116); drawSprite(context, render.cannon_asset, 318, 282, 76, 57);
      if (state.result?.path?.length) {
        const scale = Number(render.path_scale || 48) / Number(currentStage().interaction.config.body_radius), points = state.result.path.map((point) => ({ x: center[0] + point.x * scale, y: center[1] - point.y * scale }));
        context.strokeStyle = state.result.success ? COLORS.result : COLORS.danger; context.lineWidth = 3; context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke();
        const progress = state.reducedMotion ? 1 : Math.min(1, (now - state.result.started_at) / 1350), projectile = points[Math.min(points.length - 1, Math.floor(progress * (points.length - 1)))];
        if (projectile) drawSprite(context, render.projectile_asset, projectile.x - 7, projectile.y - 7, 14);
      }
    }
  }

  const ExperienceRunner = { start() { state.started = true; dom.startCard.hidden = true; dom.copy.hidden = false; dom.deck.hidden = false; playCue("click"); renderStage(); } };
  window.PixelScience = { PackLoader, InteractionRegistry, ExperienceRunner, ModelEngine };

  dom.brand.textContent = PACK.manifest.series_title || "像素科学剧场";
  document.title = PACK.manifest.title;
  dom.shell.setAttribute("aria-label", PACK.manifest.title);
  dom.startTitle.textContent = PACK.manifest.title;
  dom.startDescription.textContent = PACK.concept.short_description;
  dom.start.addEventListener("click", () => ExperienceRunner.start());
  dom.settings.addEventListener("click", () => openModal("settings"));
  dom.modalClose.addEventListener("click", closeModal);
  dom.hint.addEventListener("click", revealHint);
  dom.deeper.addEventListener("click", () => openModal("deeper"));
  dom.next.addEventListener("click", nextStage);
  dom.shell.addEventListener("pointerdown", (event) => {
    if (state.started) recordInteraction();
    if (state.hotspotId && !(event.target instanceof Element && event.target.closest("[data-hotspot-id]"))) clearHotspot();
  });
  window.addEventListener("resize", updateScale);
  systemMotionQuery.addEventListener?.("change", (event) => { if (!state.reducedMotionOverridden) { state.reducedMotion = event.matches; dom.app.classList.toggle("reduce-motion", state.reducedMotion); updateStatus(); } });
  document.addEventListener("keydown", (event) => {
    if (state.started) recordInteraction();
    if (!dom.modal.hidden && event.key === "Escape") { closeModal(); return; }
    if (dom.modal.hidden && event.key === "Escape" && state.hotspotId) { event.preventDefault(); clearHotspot(true); return; }
    if (!dom.modal.hidden && event.key === "Tab") {
      const focusable = [...dom.modal.querySelectorAll("button,input")], first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    const targetIsControl = event.target instanceof Element && event.target.closest("button,input,a,select,textarea");
    if (!state.started && !targetIsControl && (event.key === "Enter" || event.key === " ") && state.assetsReady) { event.preventDefault(); ExperienceRunner.start(); }
  });

  dom.app.classList.toggle("reduce-motion", state.reducedMotion); renderStage(); updateScale();
  loadRequiredAssets().then(() => {
    state.assetsReady = true; dom.start.disabled = false; dom.start.textContent = "进入实验"; updateStatus(); animationRequest = requestAnimationFrame(draw);
  }).catch((error) => showFatal(error.message));
  window.addEventListener("beforeunload", () => cancelAnimationFrame(animationRequest));
}());
