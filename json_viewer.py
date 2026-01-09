import json
import sys
import traceback
from datetime import datetime


class JsonViewerNode:
    """
    显示格式化 JSON 的节点（类似 Crystools）
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "any_input": ("*", {}),
            },
            "optional": {
                "auto_format": (["true", "false"], {"default": "true"}),
                "show_types": (["true", "false"], {"default": "false"}),
                "only_show_openpose": (["true", "false"], {"default": "true"}),
                "max_depth": ("INT", {
                    "default": 10,
                    "min": 1,
                    "max": 20,
                    "step": 1
                }),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    FUNCTION = "process"
    CATEGORY = "utils/viewers"
    OUTPUT_NODE = True

    def process(self, any_input, auto_format="true", show_types="false", only_show_openpose="true",
                max_depth=10, unique_id=None, prompt=None, extra_pnginfo=None):

        try:
            input_data = self._serialize(any_input, max_depth=max_depth)
            indent = 2 if auto_format == "true" else None

            # 创建要显示的数据
            display_data = {
                "node_id": unique_id,
                "timestamp": datetime.now().isoformat(),
                "data": input_data,
            }

            # 生成格式化字符串 - 确保正确的JSON格式
            json_str = json.dumps(display_data, indent=indent, default=str, ensure_ascii=False)

            # 如果只显示OpenPose数据且数据是OpenPose格式
            openpose_data = None
            if only_show_openpose == "true" and isinstance(input_data, list):
                # 检查是否是OpenPose格式
                if input_data and isinstance(input_data[0], dict) and "people" in input_data[0]:
                    json_str = json.dumps(input_data, indent=indent, default=str, ensure_ascii=False)

            type_info = ""
            if show_types == "true":
                type_info = json.dumps({
                    "python_type": str(type(any_input)),
                    "comfy_type": getattr(any_input, "__class__.__name__", "unknown")
                }, indent=2, ensure_ascii=False)

            # 返回格式必须包含 text 字段
            result = {
                "ui": {
                    "text": json_str,  # 完整的JSON字符串
                    "type_info": type_info,
                },
                "result": (None,)
            }

            return result

        except Exception as e:
            error_data = {
                "error": str(e),
                "traceback": traceback.format_exc(),
                "timestamp": datetime.now().isoformat()
            }
            error_json = json.dumps(error_data, indent=2, ensure_ascii=False)
            return {
                "ui": {
                    "text": error_json,
                },
                "result": (None,)
            }

    def _serialize(self, obj, depth=0, max_depth=10):
        """递归序列化对象"""
        if depth >= max_depth:
            return f"<max_depth {max_depth} reached>"

        if obj is None:
            return None
        elif isinstance(obj, (str, int, float, bool)):
            return obj
        elif isinstance(obj, dict):
            return {str(k): self._serialize(v, depth + 1, max_depth) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple, set)):
            return [self._serialize(item, depth + 1, max_depth) for item in obj]
        elif hasattr(obj, '__dict__'):
            # 尝试获取对象属性
            try:
                return self._serialize(obj.__dict__, depth + 1, max_depth)
            except:
                return str(obj)
        else:
            # 其他情况返回字符串表示
            return str(obj)


# 节点映射
NODE_CLASS_MAPPINGS = {
    "JsonViewer": JsonViewerNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "JsonViewer": "JSON Viewer"
}

WEB_DIRECTORY = "./web"  # 指向 web 目录
