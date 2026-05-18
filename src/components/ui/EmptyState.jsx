import { Button } from './button';
export function EmptyState({ icon: Icon, title, description, action }) {
    return (<div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground"/>
      </div>
      <h3 className="section-title text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs">{description}</p>
      {action && (<Button size="touch" onClick={action.onClick}>
          {action.label}
        </Button>)}
    </div>);
}
