import { Context,loading } from '@koishijs/client'
import Updating from './res/vue/updating.vue'
import EULA from './res/vue/EULA.vue'

export default (ctx: Context) => {
    // 此 Context 非彼 Context
    // 我们只是在前端同样实现了一套插件逻辑

    // ctx.page({
    //     name: 'Systools 终端用户协议',
    //     path: '/systools/EULA',
    //     component: EULA
    //   })
    return

    // const messageBox = loading({
    //     text: 'Updating systools!',
    //     background: `<div class="backdrop" style="font-family: Microsoft Yahei; background-color: #006dae; width: 100%; height: 100%; z-index: 114514; position: fixed;"/>`,
    //     beforeClose: () => {
    //         return false
    //     }
    // })

    // messageBox.close()
}
